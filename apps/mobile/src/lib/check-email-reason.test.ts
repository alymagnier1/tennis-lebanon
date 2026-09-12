import { describe, expect, it } from "vitest";
import { parseCheckEmailReason } from "./check-email-reason";

describe("parseCheckEmailReason", () => {
  it("defaults to confirm and accepts reset", () => {
    expect(parseCheckEmailReason(undefined)).toBe("confirm");
    expect(parseCheckEmailReason("confirm")).toBe("confirm");
    expect(parseCheckEmailReason("reset")).toBe("reset");
    expect(parseCheckEmailReason(["reset"])).toBe("reset");
  });
});
