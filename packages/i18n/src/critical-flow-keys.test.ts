import { describe, expect, it } from "vitest";
import { flattenLocaleStrings, isCriticalFlowKey } from "./critical-flow-keys";

describe("critical flow locale keys", () => {
  it("detects keys under pilot-critical prefixes", () => {
    expect(isCriticalFlowKey("matches.hub.title")).toBe(true);
    expect(isCriticalFlowKey("dashboard.login.title")).toBe(false);
  });

  it("flattens nested locale objects", () => {
    expect(
      flattenLocaleStrings({
        auth: { signInTitle: "Sign in" },
        common: { cancel: "Cancel" },
      }),
    ).toEqual({
      "auth.signInTitle": "Sign in",
      "common.cancel": "Cancel",
    });
  });
});
