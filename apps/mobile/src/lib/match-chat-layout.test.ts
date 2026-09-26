import { describe, expect, it } from "vitest";
import {
  COMPOSER_GAP_ABOVE_KEYBOARD,
  composerBottomPadding,
  senderColorIndex,
  timestampSpacer,
} from "./match-chat-layout";

describe("composerBottomPadding", () => {
  it("clears the navigation bar while the keyboard is closed", () => {
    expect(
      composerBottomPadding({ bottomInset: 48, keyboardVisible: false }),
    ).toBe(48);
  });

  it("keeps a minimum on phones with no navigation bar inset", () => {
    expect(
      composerBottomPadding({ bottomInset: 0, keyboardVisible: false }),
    ).toBe(10);
  });

  it("drops the navigation-bar padding while the keyboard is open (the reported gap)", () => {
    expect(
      composerBottomPadding({ bottomInset: 48, keyboardVisible: true }),
    ).toBe(COMPOSER_GAP_ABOVE_KEYBOARD);
    expect(COMPOSER_GAP_ABOVE_KEYBOARD).toBeLessThan(10);
  });
});

describe("senderColorIndex", () => {
  const ids = [
    "34c31b48-ea9b-4eff-9762-ed6e8c4443df",
    "68d6cf5c-3462-4e84-b117-80ec29e3c73c",
    "e209165b-d877-4681-b9bd-6a87b60d428a",
  ];

  it("gives the same author the same colour every time", () => {
    for (const id of ids) {
      expect(senderColorIndex(id, 6)).toBe(senderColorIndex(id, 6));
    }
  });

  it("stays inside the palette", () => {
    for (const id of ids) {
      const index = senderColorIndex(id, 6);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(6);
    }
  });

  it("does not collapse different authors onto one colour", () => {
    expect(
      new Set(ids.map((id) => senderColorIndex(id, 6))).size,
    ).toBeGreaterThan(1);
  });

  it("falls back to the first colour for an empty palette", () => {
    expect(senderColorIndex("anyone", 0)).toBe(0);
  });
});

describe("timestampSpacer", () => {
  it("is invisible whitespace", () => {
    expect(timestampSpacer("18:45").trim()).toBe("");
  });

  it("grows with longer time formats, such as 12-hour clocks", () => {
    expect(timestampSpacer("10:45 PM").length).toBeGreaterThan(
      timestampSpacer("18:45").length,
    );
  });
});
