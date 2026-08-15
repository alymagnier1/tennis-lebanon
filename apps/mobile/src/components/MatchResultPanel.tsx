import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  confirmMatchResult,
  disputeMatchResult,
  recordMatchAttendance,
  resubmitMatchResult,
  submitMatchResult,
  type MatchHubCard,
} from "@tennis-lebanon/api";
import {
  canConfirmResult,
  canDisputeResult,
  canRecordAttendance,
  canResubmitResult,
  canSubmitResult,
  createDefaultSetDrafts,
  createEmptySetDraft,
  formatMatchScore,
  MAX_MATCH_SETS,
  MIN_MATCH_SETS,
  parseMatchScoreDrafts,
  type MatchHubResult,
  type SetScoreDraft,
} from "@tennis-lebanon/domain";
import { AppText } from "./AppText";
import { FormField } from "./FormUi";
import { HubDestructiveLink, HubSummaryRow } from "./match/HubSummaryRow";
import {
  ChipButton,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "./onboarding-ui";
import { PlayerProfileSection } from "./player/PlayerProfileSection";
import { useLayoutDirection } from "../lib/layout-direction";
import { supabase } from "../lib/supabase";
import { tennisColors } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
};

/**
 * Side A always contains the viewer, which keeps the editor honest: your games
 * are the left column and stay the left column. It also reduces the doubles
 * question from "pair everyone up" to "who played with you?", which is one tap
 * and cannot produce an invalid pairing.
 */
function MatchScoreEditor({
  setDrafts,
  onChange,
  sideALabel,
  sideBLabel,
  disabled,
}: {
  setDrafts: SetScoreDraft[];
  onChange: (next: SetScoreDraft[]) => void;
  sideALabel: string;
  sideBLabel: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  const updateSet = (index: number, patch: Partial<SetScoreDraft>) => {
    onChange(
      setDrafts.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
  };

  return (
    <View style={styles.stack}>
      {setDrafts.map((draft, index) => (
        <View key={`set-${index}`} style={styles.stack}>
          <AppText style={styles.setLabel}>
            {t("matches.results.setLabel", { number: index + 1 })}
          </AppText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <FormField
                label={t("matches.results.gamesForLabel", {
                  name: sideALabel,
                })}
                value={draft.sideAGames}
                onChangeText={(value) =>
                  updateSet(index, { sideAGames: value })
                }
                keyboardType="number-pad"
                editable={!disabled}
                maxLength={1}
              />
            </View>
            <View style={styles.flex}>
              <FormField
                label={t("matches.results.gamesForLabel", {
                  name: sideBLabel,
                })}
                value={draft.sideBGames}
                onChangeText={(value) =>
                  updateSet(index, { sideBGames: value })
                }
                keyboardType="number-pad"
                editable={!disabled}
                maxLength={1}
              />
            </View>
          </View>
        </View>
      ))}
      <View style={styles.row}>
        {setDrafts.length < MAX_MATCH_SETS ? (
          <View style={styles.flex}>
            <FigmaSecondaryButton
              label={t("matches.results.addSet")}
              disabled={disabled}
              onPress={() => onChange([...setDrafts, createEmptySetDraft()])}
            />
          </View>
        ) : null}
        {setDrafts.length > MIN_MATCH_SETS ? (
          <View style={styles.flex}>
            <FigmaSecondaryButton
              label={t("matches.results.removeSet")}
              disabled={disabled}
              onPress={() => onChange(setDrafts.slice(0, -1))}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function MatchResultPanel({
  matchId,
  hub,
  viewerUserId,
}: {
  matchId: string;
  hub: MatchHubCard;
  viewerUserId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { rowDirection } = useLayoutDirection();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [setDrafts, setSetDrafts] = useState<SetScoreDraft[]>(() =>
    createDefaultSetDrafts(2),
  );
  const result = (hub.result as MatchHubResult | null) ?? null;
  const participants = useMemo(
    () =>
      (hub.participants as HubParticipant[] | undefined)?.filter(
        (participant) => participant.status === "accepted",
      ) ?? [],
    [hub.participants],
  );

  const isDoubles = hub.format === "doubles";
  const others = participants.filter(
    (participant) => participant.user_id !== viewerUserId,
  );
  const nameFor = (userId: string) =>
    participants.find((participant) => participant.user_id === userId)
      ?.display_name ?? "";

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["match-hub", matchId] });
    await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
    await queryClient.invalidateQueries({ queryKey: ["my-completed-matches"] });
  };

  const attendanceMutation = useMutation({
    mutationFn: (attendance: "attended" | "no_show") =>
      recordMatchAttendance(supabase, matchId, attendance),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("matches.results.attendanceError")),
  });

  const submitMutation = useMutation({
    mutationFn: ({
      score,
      sideAUserIds,
    }: {
      score: MatchHubResult["score"];
      sideAUserIds: string[];
    }) => submitMatchResult(supabase, matchId, score, sideAUserIds),
    onSuccess: async () => {
      await invalidate();
      Alert.alert(t("matches.results.submitSuccess"));
    },
    onError: () => Alert.alert(t("matches.results.submitError")),
  });

  const resubmitMutation = useMutation({
    mutationFn: ({
      score,
      sideAUserIds,
    }: {
      score: MatchHubResult["score"];
      sideAUserIds: string[];
    }) => resubmitMatchResult(supabase, matchId, score, sideAUserIds),
    onSuccess: async () => {
      setIsCorrecting(false);
      await invalidate();
      Alert.alert(t("matches.results.resubmitSuccess"));
    },
    onError: () => Alert.alert(t("matches.results.resubmitError")),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmMatchResult(supabase, matchId),
    onSuccess: async () => {
      await invalidate();
      Alert.alert(t("matches.results.confirmSuccess"));
    },
    onError: () => Alert.alert(t("matches.results.confirmError")),
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      disputeMatchResult(supabase, matchId, disputeNote.trim() || undefined),
    onSuccess: async () => {
      setDisputeNote("");
      await invalidate();
    },
    onError: () => Alert.alert(t("matches.results.disputeError")),
  });

  const showAttendance = canRecordAttendance({
    matchStatus: hub.status,
    viewerStatus: hub.viewer_status,
    viewerAttendance: hub.viewer_attendance ?? "unknown",
  });
  const showSubmit = canSubmitResult({
    matchStatus: hub.status,
    viewerStatus: hub.viewer_status,
    hasResult: Boolean(result),
  });
  const showConfirm = canConfirmResult({
    matchStatus: hub.status,
    viewerStatus: hub.viewer_status,
    viewerUserId,
    result,
  });
  const showDispute = canDisputeResult({
    matchStatus: hub.status,
    viewerStatus: hub.viewer_status,
    viewerUserId,
    result,
  });
  const showResubmit = canResubmitResult({
    viewerStatus: hub.viewer_status,
    viewerUserId,
    result,
  });

  if (
    !showAttendance &&
    !showSubmit &&
    !showConfirm &&
    !showDispute &&
    !showResubmit &&
    !result
  ) {
    return null;
  }

  // Side A is the viewer plus, in doubles, whoever they say played with them.
  const sideAUserIds = isDoubles
    ? partnerId
      ? [viewerUserId, partnerId]
      : null
    : [viewerUserId];
  const sideALabel = t("matches.results.yourSide");
  const sideBLabel = isDoubles
    ? t("matches.results.theirSide")
    : (others[0]?.display_name ?? t("matches.results.theirSide"));

  const parsedPreview = parseMatchScoreDrafts(setDrafts);
  // Three phrasings rather than one interpolated name: side A is always the
  // viewer, and "{{name}} wins" with name = "You" reads as "You wins".
  const previewWinnerLabel =
    parsedPreview.ok && sideAUserIds
      ? parsedPreview.winningSide === 1
        ? t("matches.results.derivedWinnerYou")
        : isDoubles
          ? t("matches.results.derivedWinnerThem")
          : t("matches.results.derivedWinner", { name: sideBLabel })
      : null;

  const scoreSummary = result
    ? formatMatchScore(result.score, result.viewer_side)
    : null;
  const resultWinnerLabel = result
    ? nameFor(
        result.winning_side === 1
          ? (result.side_a_user_ids[0] ?? "")
          : (participants.find(
              (participant) =>
                !result.side_a_user_ids.includes(participant.user_id),
            )?.user_id ?? ""),
      )
    : null;
  const attribution = result
    ? result.submitted_by === viewerUserId
      ? t("matches.results.reportedByYou")
      : t("matches.results.reportedBy", {
          name: result.submitted_by_name || nameFor(result.submitted_by) || "—",
        })
    : null;

  const buildScore = (
    onValid: (score: MatchHubResult["score"], sideA: string[]) => void,
  ) => {
    if (!sideAUserIds) {
      Alert.alert(
        t("matches.results.sidesTitle"),
        t("matches.results.sidesHint"),
      );
      return;
    }

    const parsed = parseMatchScoreDrafts(setDrafts);
    if (!parsed.ok) {
      const setHint =
        parsed.setIndex !== undefined
          ? t("matches.results.scoreErrors.setHint", {
              number: parsed.setIndex + 1,
            })
          : null;
      Alert.alert(
        t("matches.results.scoreErrors.title"),
        [t(`matches.results.scoreErrors.${parsed.error}`), setHint]
          .filter(Boolean)
          .join(" "),
      );
      return;
    }

    onValid(parsed.score, sideAUserIds);
  };

  const partnerPicker =
    isDoubles && others.length > 0 ? (
      <View style={styles.stack}>
        <AppText style={styles.subheading}>
          {t("matches.results.sidesTitle")}
        </AppText>
        <AppText style={styles.muted}>{t("matches.results.sidesHint")}</AppText>
        <View style={[styles.chips, { flexDirection: rowDirection }]}>
          {others.map((participant) => (
            <ChipButton
              key={participant.user_id}
              label={participant.display_name}
              selected={partnerId === participant.user_id}
              onPress={() => setPartnerId(participant.user_id)}
            />
          ))}
        </View>
      </View>
    ) : null;

  const scoreEditor = (
    <>
      {partnerPicker}
      {sideAUserIds ? (
        <>
          <MatchScoreEditor
            setDrafts={setDrafts}
            onChange={setSetDrafts}
            sideALabel={sideALabel}
            sideBLabel={sideBLabel}
            disabled={submitMutation.isPending || resubmitMutation.isPending}
          />
          {previewWinnerLabel ? (
            <AppText style={styles.muted}>{previewWinnerLabel}</AppText>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <PlayerProfileSection title={t("matches.results.title")}>
      {result ? (
        <>
          <HubSummaryRow
            label={t("matches.results.statusLabel")}
            value={t(`matches.results.status.${result.status}`)}
          />
          {resultWinnerLabel ? (
            <HubSummaryRow
              label={t("matches.results.winnerLabel")}
              value={resultWinnerLabel}
            />
          ) : null}
          {scoreSummary ? (
            <HubSummaryRow
              label={t("matches.results.scoreLabel")}
              value={scoreSummary}
            />
          ) : null}
          {/* The founder's call: an unconfirmed score is shown, always
              attributed, so the other player can see the claim and correct it
              rather than discovering it later in their history. */}
          {attribution ? (
            <AppText style={styles.muted}>{attribution}</AppText>
          ) : null}
          {result.status === "unverified" ? (
            <AppText style={styles.muted}>
              {t("matches.results.unverifiedHint")}
            </AppText>
          ) : null}
        </>
      ) : null}

      {showAttendance ? (
        <View style={styles.stack}>
          <AppText style={styles.muted}>
            {t("matches.results.attendancePrompt")}
          </AppText>
          <FigmaPrimaryButton
            label={t("matches.results.attended")}
            loading={attendanceMutation.isPending}
            onPress={() => attendanceMutation.mutate("attended")}
          />
          <FigmaSecondaryButton
            label={t("matches.results.noShow")}
            disabled={attendanceMutation.isPending}
            onPress={() => attendanceMutation.mutate("no_show")}
          />
        </View>
      ) : null}

      {showSubmit ? (
        <View style={styles.stack}>
          <AppText style={styles.muted}>
            {t("matches.results.submitPrompt")}
          </AppText>
          <AppText style={styles.muted}>
            {t("matches.results.optionalScoreHint")}
          </AppText>
          {scoreEditor}
          {sideAUserIds ? (
            <FigmaPrimaryButton
              label={t("matches.results.submit")}
              loading={submitMutation.isPending}
              onPress={() =>
                buildScore((score, sideA) =>
                  submitMutation.mutate({ score, sideAUserIds: sideA }),
                )
              }
            />
          ) : null}
        </View>
      ) : null}

      {showConfirm ? (
        <View style={styles.stack}>
          <AppText style={styles.muted}>
            {t("matches.results.awaitingYou")}
          </AppText>
          <FigmaPrimaryButton
            label={t("matches.results.confirm")}
            loading={confirmMutation.isPending}
            onPress={() => confirmMutation.mutate()}
          />
        </View>
      ) : null}

      {showDispute ? (
        <View style={styles.stack}>
          {/* dispute_match_result has always accepted a note and the UI never
              sent one, so operators only ever saw that somebody objected. */}
          <FormField
            label={t("matches.results.disputeNoteLabel")}
            value={disputeNote}
            onChangeText={setDisputeNote}
            editable={!disputeMutation.isPending}
            maxLength={200}
          />
          <HubDestructiveLink
            label={t("matches.results.thatsWrong")}
            onPress={() => disputeMutation.mutate()}
          />
        </View>
      ) : null}

      {showResubmit ? (
        <View style={styles.stack}>
          <AppText style={styles.muted}>
            {t("matches.results.resubmitPrompt")}
          </AppText>
          {isCorrecting ? (
            <>
              {scoreEditor}
              {sideAUserIds ? (
                <FigmaPrimaryButton
                  label={t("matches.results.resubmit")}
                  loading={resubmitMutation.isPending}
                  onPress={() =>
                    buildScore((score, sideA) =>
                      resubmitMutation.mutate({ score, sideAUserIds: sideA }),
                    )
                  }
                />
              ) : null}
            </>
          ) : (
            <FigmaPrimaryButton
              label={t("matches.results.resubmit")}
              onPress={() => setIsCorrecting(true)}
            />
          )}
        </View>
      ) : null}
    </PlayerProfileSection>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  setLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  muted: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
    lineHeight: 20,
  },
  subheading: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  chips: {
    flexWrap: "wrap",
    gap: 8,
  },
});
