import { afterEach, describe, expect, it, vi } from "vitest";

const backMock = vi.fn();
const replaceMock = vi.fn();
const canGoBackMock = vi.fn();

vi.mock("expo-router", () => ({
  router: {
    back: backMock,
    replace: replaceMock,
    canGoBack: canGoBackMock,
  },
}));

describe("exitMatchHub", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("goes back when navigation history exists", async () => {
    canGoBackMock.mockReturnValue(true);
    const { exitMatchHub } = await import("./navigation");

    exitMatchHub();

    expect(backMock).toHaveBeenCalledOnce();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("replaces to matches tab when there is no history", async () => {
    canGoBackMock.mockReturnValue(false);
    const { exitMatchHub, MATCHES_TAB_ROUTE } = await import("./navigation");

    exitMatchHub();

    expect(replaceMock).toHaveBeenCalledWith(MATCHES_TAB_ROUTE);
    expect(backMock).not.toHaveBeenCalled();
  });
});

describe("exitProfileScreen", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("goes back when navigation history exists", async () => {
    canGoBackMock.mockReturnValue(true);
    const { exitProfileScreen } = await import("./navigation");

    exitProfileScreen();

    expect(backMock).toHaveBeenCalledOnce();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("replaces to profile tab when there is no history", async () => {
    canGoBackMock.mockReturnValue(false);
    const { exitProfileScreen, PROFILE_TAB_ROUTE } =
      await import("./navigation");

    exitProfileScreen();

    expect(replaceMock).toHaveBeenCalledWith(PROFILE_TAB_ROUTE);
    expect(backMock).not.toHaveBeenCalled();
  });
});

describe("exitPlayerProfile", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("goes back when navigation history exists", async () => {
    canGoBackMock.mockReturnValue(true);
    const { exitPlayerProfile } = await import("./navigation");

    exitPlayerProfile();

    expect(backMock).toHaveBeenCalledOnce();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("replaces to discover when there is no history", async () => {
    canGoBackMock.mockReturnValue(false);
    const { exitPlayerProfile, DISCOVER_TAB_ROUTE } =
      await import("./navigation");

    exitPlayerProfile();

    expect(replaceMock).toHaveBeenCalledWith(DISCOVER_TAB_ROUTE);
    expect(backMock).not.toHaveBeenCalled();
  });
});

describe("exitClubDetail", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("goes back when navigation history exists", async () => {
    canGoBackMock.mockReturnValue(true);
    const { exitClubDetail } = await import("./navigation");

    exitClubDetail();

    expect(backMock).toHaveBeenCalledOnce();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("replaces to clubs tab when there is no history", async () => {
    canGoBackMock.mockReturnValue(false);
    const { exitClubDetail, CLUBS_TAB_ROUTE } = await import("./navigation");

    exitClubDetail();

    expect(replaceMock).toHaveBeenCalledWith(CLUBS_TAB_ROUTE);
    expect(backMock).not.toHaveBeenCalled();
  });
});
