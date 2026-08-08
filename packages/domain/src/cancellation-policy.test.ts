import { describe, expect, it } from "vitest";
import {
  LATE_CANCEL_HOURS,
  canCreatorCancelMatch,
  canParticipantLeave,
  canParticipantWithdraw,
  cancelPolicyMessageKey,
  classifyWithdrawalTiming,
  leavePolicyMessageKey,
  requiresCancelReason,
} from "./cancellation-policy";

describe("cancellation policy", () => {
  it("classifies withdrawal timing against the late window", () => {
    const now = new Date("2030-01-01T12:00:00.000Z");
    expect(classifyWithdrawalTiming("2030-01-05T12:00:00.000Z", now)).toBe(
      "cancelled_in_time",
    );
    expect(classifyWithdrawalTiming("2030-01-01T14:00:00.000Z", now)).toBe(
      "late_cancel",
    );
  });

  it("requires cancel reasons after the match fills", () => {
    expect(requiresCancelReason("open")).toBe(false);
    expect(requiresCancelReason("full")).toBe(true);
    expect(requiresCancelReason("confirmed")).toBe(true);
  });

  it("gates leave and withdraw actions", () => {
    expect(canParticipantLeave("ready_to_book", false)).toBe(true);
    expect(canParticipantLeave("ready_to_book", true)).toBe(false);
    expect(canParticipantWithdraw("confirmed", false)).toBe(true);
    expect(canCreatorCancelMatch("booking_pending")).toBe(true);
  });

  it("selects policy copy keys", () => {
    expect(leavePolicyMessageKey("open", false)).toBe(
      "matches.policy.leaveBeforeBooking",
    );
    expect(
      cancelPolicyMessageKey(
        "confirmed",
        new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      ),
    ).toBe("matches.policy.cancelLateBooking");
    expect(cancelPolicyMessageKey("open", null, 1)).toBe(
      "matches.policy.cancelNoParticipants",
    );
    expect(LATE_CANCEL_HOURS).toBe(24);
  });
});
