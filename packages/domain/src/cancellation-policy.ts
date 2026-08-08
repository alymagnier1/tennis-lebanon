export const LATE_CANCEL_HOURS = 24;

export type WithdrawalAttendanceClass = "cancelled_in_time" | "late_cancel";

export function classifyWithdrawalTiming(
  bookingStartsAt: string | null | undefined,
  now = new Date(),
): WithdrawalAttendanceClass {
  if (!bookingStartsAt) {
    return "cancelled_in_time";
  }

  const startsAtMs = new Date(bookingStartsAt).getTime();
  if (Number.isNaN(startsAtMs)) {
    return "cancelled_in_time";
  }

  const windowMs = LATE_CANCEL_HOURS * 60 * 60 * 1000;
  return startsAtMs - now.getTime() <= windowMs
    ? "late_cancel"
    : "cancelled_in_time";
}

export function requiresCancelReason(matchStatus: string): boolean {
  return ["full", "ready_to_book", "booking_pending", "confirmed"].includes(
    matchStatus,
  );
}

export function requiresWithdrawReason(): boolean {
  return true;
}

export function canParticipantLeave(
  matchStatus: string,
  isCreator: boolean,
): boolean {
  if (isCreator) {
    return false;
  }

  return ["open", "full", "ready_to_book"].includes(matchStatus);
}

export function canParticipantWithdraw(
  matchStatus: string,
  isCreator: boolean,
): boolean {
  return !isCreator && matchStatus === "confirmed";
}

export function canCreatorCancelMatch(matchStatus: string): boolean {
  return (
    matchStatus === "draft" ||
    matchStatus === "open" ||
    matchStatus === "full" ||
    matchStatus === "ready_to_book" ||
    matchStatus === "booking_pending" ||
    matchStatus === "confirmed"
  );
}

export function leavePolicyMessageKey(
  matchStatus: string,
  hasAcceptedBooking: boolean,
): string {
  if (hasAcceptedBooking) {
    return "matches.policy.leaveAfterBooking";
  }

  if (matchStatus === "full" || matchStatus === "ready_to_book") {
    return "matches.policy.leaveAfterFull";
  }

  return "matches.policy.leaveBeforeBooking";
}

export function cancelPolicyMessageKey(
  matchStatus: string,
  bookingStartsAt: string | null | undefined,
  participantCount?: number,
): string {
  if (
    participantCount !== undefined &&
    participantCount <= 1 &&
    !["booking_pending", "confirmed"].includes(matchStatus)
  ) {
    return "matches.policy.cancelNoParticipants";
  }

  if (["booking_pending", "confirmed"].includes(matchStatus)) {
    return classifyWithdrawalTiming(bookingStartsAt) === "late_cancel"
      ? "matches.policy.cancelLateBooking"
      : "matches.policy.cancelAcceptedBooking";
  }

  if (matchStatus === "full" || matchStatus === "ready_to_book") {
    return "matches.policy.cancelAfterFull";
  }

  return "matches.policy.cancelBeforeBooking";
}
