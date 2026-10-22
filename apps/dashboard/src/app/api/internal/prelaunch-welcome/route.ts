import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import {
  dispatchPrelaunchWelcome,
  welcomeConfigured,
} from "@/lib/prelaunch-welcome.server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const token = serverEnv.PRELAUNCH_WELCOME_TOKEN;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${token || ""}`);
  if (
    !token ||
    token.length < 32 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return Response.json({ ok: false }, { status: 401 });
  if (!welcomeConfigured())
    return Response.json({ ok: false }, { status: 503 });
  const result = await dispatchPrelaunchWelcome();
  return Response.json(
    { result },
    {
      status: result === "unavailable" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
