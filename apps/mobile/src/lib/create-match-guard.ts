import type { TFunction } from "i18next";
import { router } from "expo-router";
import type { MyMatchRow } from "@tennis-lebanon/api";
import { CREATE_MATCH_ROUTE } from "./routes";
import { chooseAction } from "./confirm-action";
import { resetCreateMatchDraft } from "./create-match-draft";
import {
  activeHostedContinueRoute,
  findAnyActiveHostedMatch,
  shouldResumeDraftHostedMatch,
  type ActiveHostedMatchRef,
} from "./create-match-guard.logic";

export type { ActiveHostedMatchRef } from "./create-match-guard.logic";
export {
  activeHostedContinueRoute,
  findAnyActiveHostedMatch,
  shouldResumeDraftHostedMatch,
} from "./create-match-guard.logic";

export function showActiveHostedMatchAlert(
  active: ActiveHostedMatchRef,
  t: TFunction,
): void {
  chooseAction({
    title: t("matches.create.activeHostedTitle"),
    message: t("matches.create.activeHostedBody", {
      format: t(`formats.${active.format}`),
    }),
    confirmLabel: t("matches.create.continueInviting"),
    onConfirm: () => router.push(activeHostedContinueRoute(active)),
    // Dismissing must still lead somewhere. Opening a fresh create is what the
    // host asked for by tapping +; publish enforces the one-listing rule.
    cancelLabel: t("matches.create.cta"),
    onCancel: () => startNewMatchCreate(),
  });
}

/**
 * Opens a blank hosted-match draft. Always clears any prior player-specific prefill.
 */
export function startNewMatchCreate(): void {
  resetCreateMatchDraft();
  router.push(CREATE_MATCH_ROUTE);
}

/**
 * Opens the create flow unless the host already has an active listing.
 * Draft listings resume on the invite screen without a blocking dialog.
 * Returns false when navigation went to an existing match instead.
 */
export function openCreateMatchFlow(
  matches: MyMatchRow[] | undefined,
  t: TFunction,
): boolean {
  const active = findAnyActiveHostedMatch(matches ?? []);
  if (!active) {
    startNewMatchCreate();
    return true;
  }

  if (shouldResumeDraftHostedMatch(active)) {
    router.push(activeHostedContinueRoute(active));
    return false;
  }

  showActiveHostedMatchAlert(active, t);
  return false;
}
