import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
  env: {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPPORT_EMAIL: "test@example.com",
  },
  serverEnv: { SUPABASE_SERVICE_ROLE_KEY: "local-test-only" },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env, serverEnv: mocks.serverEnv }));
import { POST } from "./route";
const body = {
  firstName: "Preview",
  channel: "email",
  contact: "preview@example.com",
  level: "intermediate",
  court: "",
  availability: ["wd-ev"],
  adultAndContactConsent: true,
  community: "beirut",
  consentVersion: "beirut-prelaunch-v1",
  idempotencyKey: "test-signup-001",
};
function request(payload: unknown = body, key = body.idempotencyKey) {
  return new Request("http://localhost/api/prelaunch-signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      "x-forwarded-for": "192.0.2.1",
    },
    body: JSON.stringify(payload),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.SUPPORT_EMAIL = "test@example.com";
  mocks.serverEnv.SUPABASE_SERVICE_ROLE_KEY = "local-test-only";
  mocks.rpc.mockResolvedValue({ data: 0, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.from.mockImplementation(async (url: string, options: RequestInit) => {
    const payload = JSON.parse(options.body as string);
    if (url.endsWith("/rpc/consume_prelaunch_signup_attempt")) {
      const result = await mocks.rpc(
        "consume_prelaunch_signup_attempt",
        payload,
      );
      return Response.json(result.error ?? result.data, {
        status: result.error ? 503 : 200,
      });
    }
    if (url.endsWith("/prelaunch_signups")) {
      const result = await mocks.insert(payload);
      return result.error
        ? Response.json(result.error, { status: 409 })
        : new Response(null, { status: 201 });
    }
    throw new Error("Unexpected endpoint");
  });
  vi.stubGlobal("fetch", mocks.from);
});
afterEach(() => vi.unstubAllGlobals());
describe("public waitlist endpoint", () => {
  it("stores the v2 notice version submitted by the current form", async () => {
    const response = await POST(
      request({ ...body, consentVersion: "beirut-prelaunch-v2" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ consent_version: "beirut-prelaunch-v2" }),
    );
  });

  it("returns a recoverable failure on connection loss", async () => {
    mocks.from.mockRejectedValue(new TypeError("offline"));
    expect((await POST(request())).status).toBe(503);
  });
  it("inserts only a waitlist row after consuming a hashed-address attempt", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("consume_prelaunch_signup_attempt", {
      p_ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: body.contact,
        idempotency_key: body.idempotencyKey,
      }),
    );
  });
  it("does not reveal whether a contact was already listed", async () => {
    mocks.insert.mockResolvedValue({
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "prelaunch_signups_community_contact"',
      },
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
  it("returns retry timing and never inserts a rate-limited signup", async () => {
    mocks.rpc.mockResolvedValue({ data: 130, error: null });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("130");
    expect(await response.json()).toEqual({ ok: false });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("fails closed when the limiter is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("does not accept signups without a real privacy contact", async () => {
    mocks.env.SUPPORT_EMAIL = "support@tennis-lebanon.invalid";
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not accept signups without the server credential", async () => {
    mocks.serverEnv.SUPABASE_SERVICE_ROLE_KEY = "";
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid consent before any database access", async () => {
    expect(
      (await POST(request({ ...body, adultAndContactConsent: false }))).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects inconsistent idempotency keys", async () => {
    expect((await POST(request(body, "other-key"))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not report persistence failure as success", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "08006" } });
    expect((await POST(request())).status).toBe(500);
  });
});
