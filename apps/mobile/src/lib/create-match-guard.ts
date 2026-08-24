import type { TFunction } from "i18next";
import { router } from "expo-router";
import type { CompatiblePlayerCard, MyMatchRow } from "@tennis-lebanon/api";
import {
  HOSTED_MATCH_CAP,
  hasReachedHostedMatchCap,
} from "@tennis-lebanon/domain";
import { CREATE_MATCH_ROUTE, MATCHES_ROUTE } from "./routes";
import { chooseAction } from "./confirm-action";
import { resetCreateMatchDraft } from "./create-match-draft";
import { beginCreateMatchForPlayer } from "./begin-create-match-for-player";
import {
  activeHostedContinueRoute,
  findAnyActiveHostedMatch,
  shouldResumeDraftHostedMatch,
} from "./create-match-guard.logic";

export type { ActiveHostedMatchRef } from "./create-match-guard.logic";
export {
  activeHostedContinueRoute,
  findAnyActiveHostedMatch,
  shouldResumeDraftHostedMatch,
} from "./create-match-guard.logic";

/**
 * A real stop, unlike the alert it replaces.
 *
 * The old one-per-format rule was a soft nudge whose dismiss action opened a
 * create anyway, because a second match was usually a reasonable thing to want.
 * A count is different: at three there is nothing to proceed to, so the only
 * useful action is the one that frees a slot.
 */
export function showMatchCapAlert(t: TFunction): void {
  chooseAction({
    title: t("matches.create.capReachedTitle", { count: HOSTED_MATCH_CAP }),
    message: t("matches.create.capReachedBody"),
    confirmLabel: t("matches.create.seeMyMatches"),
    onConfirm: () => router.push(MATCHES_ROUTE),
    cancelLabel: t("common.cancel"),
    onCancel: () => undefined,
  });
}

/**
 * "Ask to play", from Discover or a player profile.
 *
 * Guarded like the `+` button rather than walking the host four steps in to
 * meet the cap at the end. The two entry points diverging is what made the old
 * per-format rule feel arbitrary, and there is no reason to repeat it.
 */
export function openAskToPlayFlow(
  player: CompatiblePlayerCard,
  matches: MyMatchRow[] | undefined,
  t: TFunction,
): void {
  if (hasReachedHostedMatchCap(matches ?? [])) {
    showMatchCapAlert(t);
    return;
  }

  beginCreateMatchForPlayer(player);
  router.push(CREATE_MATCH_ROUTE);
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
  // An unfinished draft is picked up first -- leaving a half-written one
  // orphaned helps nobody, and it already counts against the cap anyway.
  const resumable = findAnyActiveHostedMatch(matches ?? []);
  if (resumable && shouldResumeDraftHostedMatch(resumable)) {
    router.push(activeHostedContinueRoute(resumable));
    return false;
  }

  if (hasReachedHostedMatchCap(matches ?? [])) {
    showMatchCapAlert(t);
    return false;
  }

  startNewMatchCreate();
  return true;
}
