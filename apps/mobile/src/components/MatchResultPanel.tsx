import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  confirmMatchResult,
  disputeMatchResult,
  recordMatchAttendance,
  submitMatchResult,
  type MatchHubCard,
} from "@tennis-lebanon/api";
import {
  canConfirmResult,
  canDisputeResult,
  canRecordAttendance,
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

function MatchScoreEditor({
  setDrafts,
  onChange,
  disabled,
}: {
  setDrafts: SetScoreDraft[];
  onChange: (next: SetScoreDraft[]) => void;
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
                label={t("matches.results.winnerGamesLabel")}
                value={draft.winnerGames}
                onChangeText={(value) =>
                  updateSet(index, { winnerGames: value })
                }
                keyboardType="number-pad"
                editable={!disabled}
                maxLength={1}
              />
            </View>
            <View style={styles.flex}>
              <FormField
                label={t("matches.results.loserGamesLabel")}
                value={draft.loserGames}
                onChangeText={(value) =>
                  updateSet(index, { loserGames: value })
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
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [setDrafts, setSetDrafts] = useState<SetScoreDraft[]>(() =>
    createDefaultSetDrafts(2),
  );
  const result = (hub.result as MatchHubResult | null) ?? null;
  const participants =
    (hub.participants as HubParticipant[] | undefined)?.filter(
      (participant) => participant.status === "accepted",
    ) ?? [];

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["match-hub", matchId] });
    await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
  };

  const attendanceMutation = useMutation({
    mutationFn: (attendance: "attended" | "no_show") =>
      recordMatchAttendance(supabase, matchId, attendance),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("matches.results.attendanceError")),
  });

  const submitMutation = useMutation({
    mutationFn: ({
      winnerUserId,
      score,
    }: {
      winnerUserId: string;
      score: MatchHubResult["score"];
    }) => submitMatchResult(supabase, matchId, score, winnerUserId),
    onSuccess: async () => {
      await invalidate();
      Alert.alert(t("matches.results.submitSuccess"));
    },
    onError: () => Alert.alert(t("matches.results.submitError")),
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
    mutationFn: () => disputeMatchResult(supabase, matchId),
    onSuccess: async () => {
      await invalidate();
      Alert.alert(t("matches.results.disputeSuccess"));
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

  if (
    !showAttendance &&
    !showSubmit &&
    !showConfirm &&
    !showDispute &&
    !result
  ) {
    return null;
  }

  const winnerName =
    participants.find(
      (participant) => participant.user_id === result?.winner_user_id,
    )?.display_name ?? null;
  const scoreSummary = result ? formatMatchScore(result.score) : null;
  const parsedPreview = parseMatchScoreDrafts(setDrafts);
  const scorePreview =
    parsedPreview.ok && selectedWinnerId
      ? formatMatchScore(parsedPreview.score)
      : null;

  const handleSubmit = () => {
    if (!selectedWinnerId) {
      Alert.alert(t("matches.results.selectWinner"));
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

    submitMutation.mutate({
      winnerUserId: selectedWinnerId,
      score: parsed.score,
    });
  };

  return (
    <PlayerProfileSection title={t("matches.results.title")}>
      {result ? (
        <>
          <HubSummaryRow
            label={t("matches.results.statusLabel")}
            value={t(`matches.results.status.${result.status}`)}
          />
          {winnerName ? (
            <HubSummaryRow
              label={t("matches.results.winnerLabel")}
              value={winnerName}
            />
          ) : null}
          {scoreSummary ? (
            <HubSummaryRow
              label={t("matches.results.scoreLabel")}
              value={scoreSummary}
            />
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
          <AppText style={styles.subheading}>
            {t("matches.results.selectWinner")}
          </AppText>
          <View style={[styles.chips, { flexDirection: rowDirection }]}>
            {participants.map((participant) => (
              <ChipButton
                key={participant.user_id}
                label={participant.display_name}
                selected={selectedWinnerId === participant.user_id}
                onPress={() => setSelectedWinnerId(participant.user_id)}
              />
            ))}
          </View>
          {selectedWinnerId ? (
            <>
              <MatchScoreEditor
                setDrafts={setDrafts}
                onChange={setSetDrafts}
                disabled={submitMutation.isPending}
              />
              {scorePreview ? (
                <AppText style={styles.muted}>
                  {t("matches.results.scorePreview", { score: scorePreview })}
                </AppText>
              ) : null}
              <FigmaPrimaryButton
                label={t("matches.results.submit")}
                loading={submitMutation.isPending}
                onPress={handleSubmit}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {showConfirm ? (
        <FigmaPrimaryButton
          label={t("matches.results.confirm")}
          loading={confirmMutation.isPending}
          onPress={() => confirmMutation.mutate()}
        />
      ) : null}

      {showDispute ? (
        <HubDestructiveLink
          label={t("matches.results.dispute")}
          onPress={() =>
            Alert.alert(
              t("matches.results.dispute"),
              t("matches.results.disputePrompt"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("matches.results.dispute"),
                  style: "destructive",
                  onPress: () => disputeMutation.mutate(),
                },
              ],
            )
          }
        />
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
