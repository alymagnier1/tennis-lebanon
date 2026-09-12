import { describe, expect, it } from "vitest";
import {
  clearPasswordRecoveryPending,
  isPasswordRecoveryPending,
  markPasswordRecoveryPending,
} from "./password-recovery";

describe("password recovery flag", () => {
  it("toggles pending state", () => {
    clearPasswordRecoveryPending();
    expect(isPasswordRecoveryPending()).toBe(false);
    markPasswordRecoveryPending();
    expect(isPasswordRecoveryPending()).toBe(true);
    clearPasswordRecoveryPending();
    expect(isPasswordRecoveryPending()).toBe(false);
  });
});
