import { describe, expect, it } from "vitest";
import { keyboardAvoiderBehavior } from "./keyboard-avoider";

describe("keyboardAvoiderBehavior", () => {
  it("lifts content above an open keyboard", () => {
    expect(keyboardAvoiderBehavior(true)).toBe("padding");
  });

  it("leaves the screen's own bottom padding alone while the keyboard is closed", () => {
    // In padding mode React Native sets paddingBottom to the keyboard height
    // (0 when closed), which put the create-match footer behind the
    // navigation bar.
    expect(keyboardAvoiderBehavior(false)).toBeUndefined();
  });
});
