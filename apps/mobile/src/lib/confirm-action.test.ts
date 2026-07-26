import { afterEach, describe, expect, it, vi } from "vitest";

const alertMock = vi.fn();

vi.mock("react-native", () => ({
  Alert: { alert: alertMock },
  Platform: { OS: "ios" },
}));

describe("confirmAction", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("uses Alert on native platforms", async () => {
    const { confirmAction } = await import("./confirm-action");
    const onConfirm = vi.fn();

    confirmAction({
      title: "Leave match",
      message: "Policy copy",
      confirmLabel: "Leave",
      cancelLabel: "Cancel",
      onConfirm,
    });

    expect(alertMock).toHaveBeenCalledOnce();
    const buttons = alertMock.mock.calls[0]?.[2] as Array<{
      onPress?: () => void;
    }>;
    buttons[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("uses window.confirm on web", async () => {
    vi.doMock("react-native", () => ({
      Alert: { alert: alertMock },
      Platform: { OS: "web" },
    }));

    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm: confirm });

    const { confirmAction } = await import("./confirm-action");
    const onConfirm = vi.fn();

    confirmAction({
      title: "Leave match",
      message: "Policy copy",
      confirmLabel: "Leave",
      cancelLabel: "Cancel",
      onConfirm,
    });

    expect(confirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(alertMock).not.toHaveBeenCalled();
  });
});
