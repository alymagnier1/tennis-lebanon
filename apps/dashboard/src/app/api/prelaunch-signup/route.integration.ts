// Explicitly opt-in: calls only local Supabase and removes its own test row.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/env", async () => {
  const { execFileSync } = await import("node:child_process");
  const status = JSON.parse(
    execFileSync(
      process.execPath,
      ["node_modules/supabase/dist/supabase.js", "status", "-o", "json"],
      {
        encoding: "utf8",
        env: { ...process.env, DO_NOT_TRACK: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
  if (new URL(status.API_URL).hostname !== "127.0.0.1")
    throw new Error("Local Supabase required");
  return {
    env: { SUPABASE_URL: status.API_URL, SUPPORT_EMAIL: "test@example.com" },
    serverEnv: { SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY },
  };
});
import { POST } from "./route";
import { serverEnv } from "@/lib/env";
function sql(query: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_tennis-lebanon-claude-code",
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  ).trim();
}
it("persists once, lists for an operator, and never creates an account", async () => {
  const key = randomUUID();
  const testIp =
    "2001:db8:" +
    key.replaceAll("-", "").slice(0, 24).match(/.{4}/g)!.join(":");
  const ipHash = createHash("sha256")
    .update(`${testIp}\n${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`)
    .digest("hex");
  const contact = `prelaunch-${key}@example.com`;
  const before = sql(
    "select (select count(*) from auth.users)::text || ':' || (select count(*) from public.profiles)::text",
  );
  const payload = {
    firstName: "Local test",
    channel: "email",
    contact,
    level: "intermediate",
    availability: ["wd-ev"],
    adultAndContactConsent: true,
    community: "beirut",
    consentVersion: "beirut-prelaunch-v1",
    idempotencyKey: key,
  };
  function request(idempotencyKey: string) {
    return new Request("http://localhost/api/prelaunch-signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": testIp,
      },
      body: JSON.stringify({ ...payload, idempotencyKey }),
    });
  }
  try {
    const first = await POST(request(key));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    const duplicate = await POST(request(randomUUID()));
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ ok: true });
    expect(
      sql(
        `select count(*) from public.prelaunch_signups where contact='${contact}'`,
      ),
    ).toBe("1");
    const listed = sql(
      `begin; set local role authenticated; select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',true); select count(*) from public.list_prelaunch_signups('beirut') where contact='${contact}'; rollback;`,
    );
    expect(listed.split("\n").at(-1)).toBe("1");
    expect(
      sql(
        "select (select count(*) from auth.users)::text || ':' || (select count(*) from public.profiles)::text",
      ),
    ).toBe(before);
  } finally {
    sql(
      `delete from public.prelaunch_signups where contact='${contact}'; delete from public.prelaunch_signup_attempts where ip_hash='${ipHash}'`,
    );
  }
}, 20000);
