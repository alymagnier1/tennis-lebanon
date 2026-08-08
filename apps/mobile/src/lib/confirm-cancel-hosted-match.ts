import type { TFunction } from "i18next";
import { cancelMatch } from "@tennis-lebanon/api";
import {
  cancelPolicyMessageKey,
  requiresCancelReason,
} from "@tennis-lebanon/domain";
import { notify, presentCancelMatchDialog } from "./confirm-action";
import { supabase } from "./supabase";

export type CancelHostedMatchRef = {
  matchId: string;
  status: string;
  participantCount: number;
  bookingStartsAt?: string | null;
};

export function confirmCancelHostedMatch(
  match: CancelHostedMatchRef,
  t: TFunction,
  onCanceled?: () => void,
): void {
  const reasonRequired = requiresCancelReason(match.status);
  const hostOnly = match.participantCount <= 1;
  const policyMessage = t(
    cancelPolicyMessageKey(
      match.status,
      match.bookingStartsAt,
      match.participantCount,
    ),
    { hours: 24 },
  );

  presentCancelMatchDialog({
    title: t("matches.hub.cancel"),
    message: policyMessage,
    reasonLabel: t("matches.hub.cancelReasonLabel"),
    reasonPlaceholder: t("matches.hub.cancelReasonPlaceholder"),
    reasonRequired,
    reasonRequiredMessage: t("matches.hub.cancelReasonRequired"),
    showReasonField: !hostOnly,
    submitLabel: t("matches.hub.cancel"),
    dismissLabel: t("common.cancel"),
    onSubmit: (reason) =>
      executeCancelHostedMatch(match.matchId, reason, t, onCanceled),
  });
}

async function executeCancelHostedMatch(
  matchId: string,
  reason: string,
  t: TFunction,
  onCanceled?: () => void,
): Promise<void> {
  try {
    await cancelMatch(supabase, matchId, reason || undefined);
    notify(t("matches.hub.cancelSuccess"));
    onCanceled?.();
  } catch {
    notify(t("matches.hub.cancelError"));
    throw new Error("cancel failed");
  }
}
