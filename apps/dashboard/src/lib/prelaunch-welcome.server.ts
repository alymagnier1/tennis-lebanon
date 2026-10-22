import { env, serverEnv } from "@/lib/env";
import { welcomeEmail } from "./prelaunch-welcome-copy";

type Job = { id: string; first_name: string; contact: string; lease: string };
type Result = "accepted" | "transient" | "rejected";

export function welcomeEnabled() {
  return serverEnv.PRELAUNCH_WELCOME_ENABLED === "true";
}

export function welcomeConfigured() {
  return Boolean(
    welcomeEnabled() &&
    serverEnv.RESEND_API_KEY &&
    serverEnv.PRELAUNCH_WELCOME_FROM &&
    serverEnv.SUPABASE_SERVICE_ROLE_KEY &&
    !env.SUPPORT_EMAIL.endsWith(".invalid"),
  );
}

async function rpc(name: string, body: object) {
  return fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
    headers: {
      apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function sendWelcome(job: Job): Promise<Result> {
  const copy = welcomeEmail(job.first_name, env.SUPPORT_EMAIL);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `beirut-welcome-v1/${job.id}`,
      },
      body: JSON.stringify({
        from: `RacketBound <${serverEnv.PRELAUNCH_WELCOME_FROM}>`,
        to: [job.contact],
        reply_to: env.SUPPORT_EMAIL,
        ...copy,
      }),
    });
    // Never log provider bodies: they may contain recipient information.
    if (response.ok) {
      const result: unknown = await response.json();
      return result &&
        typeof result === "object" &&
        "id" in result &&
        typeof result.id === "string"
        ? "accepted"
        : "transient";
    }
    return response.status === 429 ||
      response.status >= 500 ||
      response.status === 408
      ? "transient"
      : "rejected";
  } catch {
    return "transient";
  }
}

/** Claims one durable job; cron recovers crashes and transient failures. */
export async function dispatchPrelaunchWelcome(key: string | null = null) {
  if (!welcomeConfigured()) return "disabled";
  try {
    const claimed = await rpc("claim_prelaunch_welcome", { p_key: key });
    if (!claimed.ok) return "unavailable";
    const jobs: Job[] = await claimed.json();
    if (!Array.isArray(jobs) || jobs.length === 0) return "idle";
    const job = jobs[0];
    if (!job) return "idle";
    const result = await sendWelcome(job);
    const finished = await rpc("finish_prelaunch_welcome", {
      p_id: job.id,
      p_lease: job.lease,
      p_result: result,
    });
    return finished.ok ? result : "unavailable";
  } catch {
    // The lease will expire. Retrying uses the same provider idempotency key.
    return "unavailable";
  }
}
