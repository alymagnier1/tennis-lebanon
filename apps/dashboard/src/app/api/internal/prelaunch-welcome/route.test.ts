import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  serverEnv: { PRELAUNCH_WELCOME_TOKEN: "a".repeat(40) },
  dispatch: vi.fn(),
  configured: vi.fn(() => true),
}));
vi.mock("@/lib/env", () => ({ serverEnv: m.serverEnv }));
vi.mock("@/lib/prelaunch-welcome.server", () => ({
  dispatchPrelaunchWelcome: m.dispatch,
  welcomeConfigured: m.configured,
}));
import { POST } from "./route";
function req(token?: string) {
  return new Request("https://racketbound.com/api/internal/prelaunch-welcome", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  m.serverEnv.PRELAUNCH_WELCOME_TOKEN = "a".repeat(40);
  m.configured.mockReturnValue(true);
  m.dispatch.mockResolvedValue("idle");
});
describe("private welcome worker", () => {
  it.each([undefined, "wrong", "b".repeat(40)])(
    "rejects an unauthorized caller",
    async (token) => {
      expect((await POST(req(token))).status).toBe(401);
      expect(m.dispatch).not.toHaveBeenCalled();
    },
  );
  it("fails closed without configuration", async () => {
    m.configured.mockReturnValue(false);
    expect((await POST(req(m.serverEnv.PRELAUNCH_WELCOME_TOKEN))).status).toBe(
      503,
    );
    expect(m.dispatch).not.toHaveBeenCalled();
  });
  it("allows the dedicated scheduler token", async () => {
    expect((await POST(req(m.serverEnv.PRELAUNCH_WELCOME_TOKEN))).status).toBe(
      200,
    );
    expect(m.dispatch).toHaveBeenCalledOnce();
  });
});
