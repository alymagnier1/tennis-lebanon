import { afterEach, describe, expect, it, vi } from "vitest";

const presentCancelMatchDialogMock = vi.fn();

vi.mock("./confirm-action", () => ({
  presentCancelMatchDialog: presentCancelMatchDialogMock,
}));

const t = ((key: string) => key) as import("i18next").TFunction;

describe("confirmDidNotPlay", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens a confirm dialog with an optional reason field", async () => {
    const { confirmDidNotPlay } = await import("./confirm-did-not-play");
    const onConfirm = vi.fn();

    confirmDidNotPlay(t, onConfirm);

    expect(presentCancelMatchDialogMock).toHaveBeenCalledOnce();
    const options = presentCancelMatchDialogMock.mock.calls[0]?.[0] as {
      title: string;
      reasonRequired: boolean;
      showReasonField: boolean;
      submitLabel: string;
      onSubmit: (reason: string) => void;
    };

    expect(options.title).toBe("matches.results.noShowConfirmTitle");
    expect(options.reasonRequired).toBe(false);
    expect(options.showReasonField).toBe(true);
    expect(options.submitLabel).toBe("matches.results.noShowConfirm");

    options.onSubmit("weather");
    expect(onConfirm).toHaveBeenCalledWith("weather");
  });
});
