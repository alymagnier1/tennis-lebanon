import { useState } from "react";
import { Alert, View } from "react-native";
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
  type MatchHubResult,
} from "@tennis-lebanon/domain";
import { SectionTitle } from "./AppUi";
import { AppText } from "./AppText";
import { colors } from "@tennis-lebanon/ui";
import {
  DestructiveButton,
  PrimaryButton,
  SecondaryButton,
  SummaryRow,
  formStyles,
} from "./FormUi";
import { supabase } from "../lib/supabase";

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
};

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
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const result = (hub.result as MatchHubResult | null) ?? null;
  const participants = (hub.participants as HubParticipant[] | undefined)?.filter(
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
    mutationFn: (winnerUserId: string) =>
      submitMatchResult(
        supabase,
        matchId,
        { sets: [[6, 4], [6, 3]] },
        winnerUserId,
      ),
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

  if (!showAttendance && !showSubmit && !showConfirm && !showDispute && !result) {
    return null;
  }

  const winnerName =
    participants.find((participant) => participant.user_id === result?.winner_user_id)
      ?.display_name ?? null;

  return (
    <View style={formStyles.compactCard}>
      <SectionTitle title={t("matches.results.title")} />

      {result ? (
        <>
          <SummaryRow
            label={t("matches.results.statusLabel")}
            value={t(`matches.results.status.${result.status}`)}
          />
          {winnerName ? (
            <SummaryRow label={t("matches.results.winnerLabel")} value={winnerName} />
          ) : null}
        </>
      ) : null}

      {showAttendance ? (
        <View style={formStyles.stack}>
          <AppText style={{ color: colors.neutral[500] }}>
            {t("matches.results.attendancePrompt")}
          </AppText>
          <PrimaryButton
            label={t("matches.results.attended")}
            loading={attendanceMutation.isPending}
            onPress={() => attendanceMutation.mutate("attended")}
          />
          <SecondaryButton
            label={t("matches.results.noShow")}
            disabled={attendanceMutation.isPending}
            onPress={() => attendanceMutation.mutate("no_show")}
          />
        </View>
      ) : null}

      {showSubmit ? (
        <View style={formStyles.stack}>
          <AppText style={{ color: colors.neutral[500] }}>
            {t("matches.results.submitPrompt")}
          </AppText>
          {participants.map((participant) => (
            <SecondaryButton
              key={participant.user_id}
              label={t("matches.results.winnerOption", {
                name: participant.display_name,
              })}
              onPress={() => setSelectedWinnerId(participant.user_id)}
              disabled={submitMutation.isPending}
            />
          ))}
          {selectedWinnerId ? (
            <PrimaryButton
              label={t("matches.results.submit")}
              loading={submitMutation.isPending}
              onPress={() => submitMutation.mutate(selectedWinnerId)}
            />
          ) : null}
        </View>
      ) : null}

      {showConfirm ? (
        <PrimaryButton
          label={t("matches.results.confirm")}
          loading={confirmMutation.isPending}
          onPress={() => confirmMutation.mutate()}
        />
      ) : null}

      {showDispute ? (
        <DestructiveButton
          label={t("matches.results.dispute")}
          loading={disputeMutation.isPending}
          onPress={() =>
            Alert.alert(t("matches.results.dispute"), t("matches.results.disputePrompt"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("matches.results.dispute"),
                style: "destructive",
                onPress: () => disputeMutation.mutate(),
              },
            ])
          }
        />
      ) : null}
    </View>
  );
}
