import { afterEach, describe, expect, it, vi } from "vitest";

const presentCancelMatchDialogMock = vi.fn();
const cancelMatchMock = vi.fn();
const notifyMock = vi.fn();

vi.mock("./confirm-action", () => ({
  presentCancelMatchDialog: presentCancelMatchDialogMock,
  notify: notifyMock,
}));

vi.mock("./supabase", () => ({
  supabase: {},
}));

vi.mock("@tennis-lebanon/api", () => ({
  cancelMatch: cancelMatchMock,
}));

const t = ((key: string) => key) as import("i18next").TFunction;

describe("confirmCancelHostedMatch", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the cancel dialog with reason field options", async () => {
    const { confirmCancelHostedMatch } = await import(
      "./confirm-cancel-hosted-match"
    );

    confirmCancelHostedMatch({ matchId: "m1", status: "open", participantCount: 1 }, t);

    expect(presentCancelMatchDialogMock).toHaveBeenCalledOnce();
    const options = presentCancelMatchDialogMock.mock.calls[0]?.[0] as {
      reasonRequired: boolean;
      showReasonField: boolean;
      onSubmit: (reason: string) => Promise<void>;
    };
    expect(options.reasonRequired).toBe(false);
    expect(options.showReasonField).toBe(false);

    cancelMatchMock.mockResolvedValue(undefined);
    await options.onSubmit("optional note");

    expect(cancelMatchMock).toHaveBeenCalledWith({}, "m1", "optional note");
    expect(notifyMock).toHaveBeenCalledWith("matches.hub.cancelSuccess");
  });

  it("requires a reason for full matches", async () => {
    const { confirmCancelHostedMatch } = await import(
      "./confirm-cancel-hosted-match"
    );

    confirmCancelHostedMatch(
      { matchId: "m2", status: "full", participantCount: 2 },
      t,
    );

    const options = presentCancelMatchDialogMock.mock.calls[0]?.[0] as {
      reasonRequired: boolean;
      onSubmit: (reason: string) => Promise<void>;
    };
    expect(options.reasonRequired).toBe(true);

    cancelMatchMock.mockResolvedValue(undefined);
    await options.onSubmit("group changed plans");

    expect(cancelMatchMock).toHaveBeenCalledWith(
      {},
      "m2",
      "group changed plans",
    );
  });
});
