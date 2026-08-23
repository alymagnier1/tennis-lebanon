import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  createMatchDraft,
  createMatchInvite,
  publishMatch,
  setClubFavorite,
} from "@tennis-lebanon/api";
import type { CreateMatchInput } from "@tennis-lebanon/domain";
import {
  buildCreateMatchInput,
  getCreateMatchDraft,
  resetCreateMatchDraft,
} from "../lib/create-match-draft";
import {
  markCreateFlowPublished,
  trackRematchPublished,
} from "../lib/create-flow-analytics";
import { notify } from "../lib/confirm-action";
import { matchInviteErrorKey } from "../lib/invite-link";
import { matchHubRoute, matchInviteRoute } from "../lib/routes";
import { supabase } from "../lib/supabase";

type PublishDestination = "invite" | "hub";

type PublishVariables = {
  destination: PublishDestination;
  input: CreateMatchInput;
  /**
   * Set when the host has no favourite clubs yet. Nothing seeds the club picker
   * for such a host, so they would re-pick on every create; the clubs they just
   * published with become their favourites and pre-fill the next one.
   */
  seedFavoriteClubs: boolean;
};

function isActiveHostedMatchError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  return message.includes("active_hosted_match_exists");
}

function publishValidationMessage(
  error: string,
  t: (key: string) => string,
): string {
  switch (error) {
    case "incomplete":
      return t("matches.create.incomplete");
    case "time_in_past":
      return t("matches.create.reviewTimeInPast");
    case "club_required":
      return t("matches.create.clubRequired");
    default:
      return t("matches.create.reviewValidationError");
  }
}

export function usePublishMatch(options?: {
  onValidationError?: (message: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      destination,
      input,
      seedFavoriteClubs,
    }: PublishVariables) => {
      const draft = getCreateMatchDraft();
      const targetPlayerId = draft.targetPlayerId;
      // Read before the draft is reset in onSuccess.
      const rematchSurface = draft.rematchSurface;
      const matchId = await createMatchDraft(supabase, input);
      // Carried out, not thrown. The match is created and published by the time
      // the invite runs, so letting the invite reject the mutation reported a
      // live match as "we could not publish this match" -- and left the draft
      // in place, so retrying hit `active_hosted_match_exists` and contradicted
      // the first message. A blocked target or the 20-a-day invite ceiling is
      // enough to trigger it.
      let inviteError: unknown = null;
      if (destination === "hub") {
        await publishMatch(supabase, matchId);
        if (targetPlayerId) {
          try {
            await createMatchInvite(supabase, matchId, targetPlayerId);
          } catch (error) {
            inviteError = error;
          }
        }
      }
      // Read off the built input rather than the draft: the draft is reset in
      // onSuccess, and these are the ids the match was actually created with.
      return {
        matchId,
        destination,
        targetPlayerId,
        inviteError,
        rematchSurface,
        favoriteClubIds: seedFavoriteClubs
          ? (input.preferredClubIds ?? [])
          : [],
      };
    },
    onSuccess: async ({
      matchId,
      destination,
      targetPlayerId,
      inviteError,
      rematchSurface,
      favoriteClubIds,
    }) => {
      if (typeof matchId !== "string" || matchId.length === 0) {
        notify(t("matches.create.publishError"));
        return;
      }

      // Before the navigation below, or the create stack's unmount would read
      // this flow as abandoned.
      markCreateFlowPublished();
      trackRematchPublished(rematchSurface);

      const invitedTargetPlayer =
        destination === "hub" && Boolean(targetPlayerId);
      resetCreateMatchDraft();

      // Best effort: the match is already published, so a failure here must not
      // surface as a publish error. set_club_favorite is `on conflict do
      // nothing`, so repeating it is harmless.
      if (favoriteClubIds.length > 0) {
        await Promise.all(
          favoriteClubIds.map((clubId) =>
            setClubFavorite(supabase, clubId, true).catch(() => undefined),
          ),
        );
        await queryClient.invalidateQueries({ queryKey: ["clubs-directory"] });
      }

      await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      router.replace(
        destination === "invite"
          ? matchInviteRoute(matchId, { invitePlayerId: targetPlayerId })
          : matchHubRoute(matchId),
      );

      if (invitedTargetPlayer) {
        if (inviteError) {
          // The match is live either way; say which half failed and why.
          notify(
            t("matches.invite.notSentTitle"),
            t(matchInviteErrorKey(inviteError)),
          );
        } else {
          notify(t("matches.invite.sent"));
        }
      }
    },
    onError: (error) => {
      if (isActiveHostedMatchError(error)) {
        const draft = getCreateMatchDraft();
        notify(
          t("matches.create.activeHostedTitle"),
          t("matches.create.activeHostedBody", {
            format: draft.format ? t(`formats.${draft.format}`) : "",
          }),
        );
        return;
      }

      notify(t("matches.create.publishError"));
    },
  });

  function publish(
    destination: PublishDestination,
    notes?: string,
    publishOptions?: { seedFavoriteClubs?: boolean },
  ) {
    const built = buildCreateMatchInput(notes?.trim() || undefined);
    if (!built.success) {
      const message = publishValidationMessage(built.error, t);
      options?.onValidationError?.(message);
      notify(t("matches.create.scheduleTitle"), message);
      return;
    }

    mutation.mutate({
      destination,
      input: built.data,
      seedFavoriteClubs: publishOptions?.seedFavoriteClubs ?? false,
    });
  }

  return {
    publish,
    isPublishing: mutation.isPending,
    publishValidationMessage: (error: string) =>
      publishValidationMessage(error, t),
  };
}
