import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  env: {
    SUPABASE_URL: "https://example.supabase.co",
    SUPPORT_EMAIL: "support@example.com",
  },
  serverEnv: {
    PRELAUNCH_WELCOME_ENABLED: "true",
    RESEND_API_KEY: "test-only",
    PRELAUNCH_WELCOME_FROM: "hello@example.com",
    SUPABASE_SERVICE_ROLE_KEY: "test-only",
  },
  fetch: vi.fn(),
}));
vi.mock("@/lib/env", () => m);
import {
  dispatchPrelaunchWelcome,
  sendWelcome,
} from "./prelaunch-welcome.server";
import { welcomeEmail } from "./prelaunch-welcome-copy";
const job = {
  id: "row-1",
  first_name: "Rami",
  contact: "rami@example.com",
  lease: "lease-1",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.serverEnv.PRELAUNCH_WELCOME_ENABLED = "true";
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(() => vi.unstubAllGlobals());
describe("waitlist welcome delivery", () => {
  it("uses the persisted row ID for provider deduplication and a working reply address", async () => {
    m.fetch.mockResolvedValue(Response.json({ id: "message-1" }));
    expect(await sendWelcome(job)).toBe("accepted");
    const [url, opts] = m.fetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.headers["Idempotency-Key"]).toBe("beirut-welcome-v1/row-1");
    const message = JSON.parse(opts.body);
    expect(message.to).toEqual([job.contact]);
    expect(message.reply_to).toBe("support@example.com");
    expect(message.text).toContain("when access opens for you");
    expect(message.html).toBeUndefined();
  });
  it.each([429, 500, 503, 408])(
    "retries transient provider status %s",
    async (status) => {
      m.fetch.mockResolvedValue(new Response(null, { status }));
      expect(await sendWelcome(job)).toBe("transient");
    },
  );
  it.each([400, 401, 403, 422, 409])(
    "stops on permanent provider status %s",
    async (status) => {
      m.fetch.mockResolvedValue(new Response(null, { status }));
      expect(await sendWelcome(job)).toBe("rejected");
    },
  );
  it("records a retry after an ambiguous connection failure", async () => {
    m.fetch.mockRejectedValue(new Error("timeout"));
    expect(await sendWelcome(job)).toBe("transient");
  });
  it("sends nothing when disabled", async () => {
    m.serverEnv.PRELAUNCH_WELCOME_ENABLED = "false";
    expect(await dispatchPrelaunchWelcome()).toBe("disabled");
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("sends nothing when another worker already claimed the job", async () => {
    m.fetch.mockResolvedValue(Response.json([]));
    expect(await dispatchPrelaunchWelcome()).toBe("idle");
    expect(m.fetch).toHaveBeenCalledTimes(1);
  });
  it("acknowledges only the claimed lease after provider acceptance", async () => {
    m.fetch
      .mockResolvedValueOnce(Response.json([job]))
      .mockResolvedValueOnce(Response.json({ id: "message-1" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await dispatchPrelaunchWelcome("request-key")).toBe("accepted");
    expect(JSON.parse(m.fetch.mock.calls[0]![1].body)).toEqual({
      p_key: "request-key",
    });
    expect(JSON.parse(m.fetch.mock.calls[2]![1].body)).toEqual({
      p_id: job.id,
      p_lease: job.lease,
      p_result: "accepted",
    });
  });
  it("leaves an unacknowledged send recoverable through the same key", async () => {
    m.fetch
      .mockResolvedValueOnce(Response.json([job]))
      .mockResolvedValueOnce(Response.json({ id: "message-1" }))
      .mockRejectedValueOnce(new Error("database offline"));
    expect(await dispatchPrelaunchWelcome()).toBe("unavailable");
  });
  it("keeps the welcome a receipt with no claim of immediate access", () => {
    const message = welcomeEmail("Rami\nTest", "support@example.com");
    expect(message.text).toContain("Hi Rami Test,");
    expect(message.text).toContain("Questions? Contact support@example.com.");
    expect(message.text).toMatch(/RacketBound$/);
  });
});
