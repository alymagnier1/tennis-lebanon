import type { TFunction } from "i18next";
import { presentCancelMatchDialog } from "./confirm-action";

/**
 * Confirm "I did not play" before recording no-show attendance. Optional note
 * is forwarded to the RPC for a private audit trail — not shown to opponents.
 */
export function confirmDidNotPlay(
  t: TFunction,
  onConfirm: (reason: string) => void | Promise<void>,
): void {
  presentCancelMatchDialog({
    title: t("matches.results.noShowConfirmTitle"),
    message: t("matches.results.noShowConfirmMessage"),
    reasonLabel: t("matches.results.noShowReasonLabel"),
    reasonPlaceholder: t("matches.results.noShowReasonPlaceholder"),
    reasonRequired: false,
    reasonRequiredMessage: t("matches.results.noShowReasonRequired"),
    showReasonField: true,
    submitLabel: t("matches.results.noShowConfirm"),
    dismissLabel: t("common.cancel"),
    onSubmit: onConfirm,
  });
}
