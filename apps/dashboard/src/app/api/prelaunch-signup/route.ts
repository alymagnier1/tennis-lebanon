import { createHash } from "node:crypto";
import {
  isBenignPrelaunchConflict,
  parsePrelaunchSignup,
} from "@tennis-lebanon/domain";
import { env, serverEnv } from "@/lib/env";

export const runtime = "nodejs";

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) {
    return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function json(ok: boolean, status: number): Response {
  return Response.json(
    { ok },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Public waitlist write. The service role stays on the server.
 * Success and a duplicate both return {ok:true}. Nothing is logged.
 */
export async function POST(request: Request): Promise<Response> {
  const serviceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || env.SUPPORT_EMAIL.endsWith(".invalid")) {
    return json(false, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(false, 400);
  }

  const parsed = parsePrelaunchSignup(body);
  if (!parsed.ok) {
    return json(false, 400);
  }

  const headerKey = request.headers.get("idempotency-key");
  if (headerKey && headerKey !== parsed.row.idempotencyKey) {
    return json(false, 400);
  }

  // REST-only: this write needs no auth session or realtime WebSocket client.
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  const base = env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
  const ipHash = createHash("sha256")
    .update(`${clientAddress(request)}\n${serviceKey}`)
    .digest("hex");
  try {
    // One database transaction serializes attempts for this hashed address.
    const rate = await fetch(`${base}/rpc/consume_prelaunch_signup_attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_ip_hash: ipHash }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!rate.ok) return json(false, 503);
    const retryAfter: unknown = await rate.json();
    if (
      typeof retryAfter !== "number" ||
      !Number.isInteger(retryAfter) ||
      retryAfter < 0
    )
      return json(false, 503);
    if (retryAfter > 0)
      return Response.json(
        { ok: false },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "Cache-Control": "no-store",
          },
        },
      );

    const { row } = parsed;
    const inserted = await fetch(`${base}/prelaunch_signups`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        first_name: row.firstName,
        channel: row.channel,
        contact: row.contact,
        level: row.level,
        court: row.court,
        availability: row.availability,
        community: row.community,
        consent_version: row.consentVersion,
        idempotency_key: row.idempotencyKey,
      }),
    });
    if (!inserted.ok) {
      const failure = await inserted.json();
      if (
        !failure ||
        typeof failure !== "object" ||
        !isBenignPrelaunchConflict(failure)
      )
        return json(false, 500);
    }
    return json(true, 200);
  } catch {
    // Never log database errors, request bodies or contact information.
    return json(false, 503);
  }
}
