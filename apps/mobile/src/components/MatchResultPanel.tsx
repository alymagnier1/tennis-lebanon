import { useMemo, useState, type PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
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
import { useToast } from "../providers/ToastProvider";
import { supabase } from "../lib/supabase";
import {
  tennisColors,
  tennisRadii,
  tennisSpacing,
} from "../theme/tennis-tokens";
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
  const { rowDirection } = useLayoutDirection();

  const updateSet = (index: number, patch: Partial<SetScoreDraft>) => {
    onChange(
      setDrafts.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
  };

  return (
    <View style={styles.scoreBlock}>
      <View style={[styles.scoreHeaderRow, { flexDirection: rowDirection }]}>
        <AppText style={styles.scoreColumnLabel} maxLines={1}>
          {sideALabel}
        </AppText>
        <View style={styles.scoreDashSpacer} />
        <AppText style={styles.scoreColumnLabel} maxLines={1}>
          {sideBLabel}
        </AppText>
      </View>

      {setDrafts.map((draft, index) => (
        <View key={`set-${index}`} style={styles.setCard}>
          <AppText style={styles.setLabel}>
            {t("matches.results.setLabel", { number: index + 1 })}
          </AppText>
          <View style={[styles.scoreInputRow, { flexDirection: rowDirection }]}>
            <View style={styles.scoreInputWrap}>
              <TextInput
                accessibilityLabel={t("matches.results.gamesForLabel", {
                  name: sideALabel,
                })}
                value={draft.sideAGames}
                onChangeText={(value) =>
                  updateSet(index, {
                    sideAGames: value.replace(/[^0-9]/g, ""),
                  })
                }
                keyboardType="number-pad"
                editable={!disabled}
                maxLength={1}
                placeholder="0"
                placeholderTextColor={tennisColors.mutedForeground}
                style={[
                  styles.scoreInput,
                  disabled ? styles.scoreInputDisabled : null,
                ]}
              />
            </View>
            <AppText style={styles.scoreDash}>–</AppText>
            <View style={styles.scoreInputWrap}>
              <TextInput
                accessibilityLabel={t("matches.results.gamesForLabel", {
                  name: sideBLabel,
                })}
                value={draft.sideBGames}
                onChangeText={(value) =>
                  updateSet(index, {
                    sideBGames: value.replace(/[^0-9]/g, ""),
                  })
                }
                keyboardType="number-pad"
                editable={!disabled}
                maxLength={1}
                placeholder="0"
                placeholderTextColor={tennisColors.mutedForeground}
                style={[
                  styles.scoreInput,
                  disabled ? styles.scoreInputDisabled : null,
                ]}
              />
            </View>
          </View>
        </View>
      ))}

      <View style={[styles.setActions, { flexDirection: rowDirection }]}>
        {setDrafts.length < MAX_MATCH_SETS ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("matches.results.addSet")}
            disabled={disabled}
            onPress={() => onChange([...setDrafts, createEmptySetDraft()])}
            style={({ pressed }) => [
              styles.setAction,
              pressed && styles.setActionPressed,
              disabled && styles.setActionDisabled,
            ]}
          >
            <AppText style={styles.setActionLabel}>
              {t("matches.results.addSet")}
            </AppText>
          </Pressable>
        ) : null}
        {setDrafts.length > MIN_MATCH_SETS ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("matches.results.removeSet")}
            disabled={disabled}
            onPress={() => onChange(setDrafts.slice(0, -1))}
            style={({ pressed }) => [
              styles.setAction,
              pressed && styles.setActionPressed,
              disabled && styles.setActionDisabled,
            ]}
          >
            <AppText style={styles.setActionLabelMuted}>
              {t("matches.results.removeSet")}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function MatchResultPanel({
  matchId,
  hub,
  viewerUserId,
  presentation = "section",
  onComplete,
}: {
  matchId: string;
  hub: MatchHubCard;
  viewerUserId: string;
  /** Sheet embeds skip the outer section chrome (title lives on the sheet). */
  presentation?: "section" | "plain";
  /** Called after a terminal action (no-show, submit, confirm, dispute). */
  onComplete?: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { rowDirection } = useLayoutDirection();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
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
    onSuccess: async (_data, attendance) => {
      // Close before refetch so "I did not play" never flashes the score form.
      if (attendance === "no_show") {
        onComplete?.();
      }
      await invalidate();
    },
    onError: () => showToast(t("matches.results.attendanceError")),
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
      setScoreError(null);
      await invalidate();
      showToast(t("matches.results.submitSuccess"));
      onComplete?.();
    },
    onError: () => showToast(t("matches.results.submitError")),
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
      setScoreError(null);
      await invalidate();
      showToast(t("matches.results.resubmitSuccess"));
      onComplete?.();
    },
    onError: () => showToast(t("matches.results.resubmitError")),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmMatchResult(supabase, matchId),
    onSuccess: async () => {
      await invalidate();
      showToast(t("matches.results.confirmSuccess"));
      onComplete?.();
    },
    onError: () => showToast(t("matches.results.confirmError")),
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      disputeMatchResult(supabase, matchId, disputeNote.trim() || undefined),
    onSuccess: async () => {
      setDisputeNote("");
      await invalidate();
      onComplete?.();
    },
    onError: () => showToast(t("matches.results.disputeError")),
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
    viewerAttendance: hub.viewer_attendance ?? "unknown",
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
      const message = t("matches.results.sidesHint");
      setScoreError(message);
      showToast(message);
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
      const message = [t(`matches.results.scoreErrors.${parsed.error}`), setHint]
        .filter(Boolean)
        .join(" ");
      setScoreError(message);
      showToast(message);
      return;
    }

    setScoreError(null);
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
            onChange={(next) => {
              setScoreError(null);
              setSetDrafts(next);
            }}
            sideALabel={sideALabel}
            sideBLabel={sideBLabel}
            disabled={submitMutation.isPending || resubmitMutation.isPending}
          />
          {previewWinnerLabel ? (
            <View style={styles.winnerPreview}>
              <AppText style={styles.winnerPreviewText}>
                {previewWinnerLabel}
              </AppText>
            </View>
          ) : null}
          {scoreError ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {scoreError}
            </AppText>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <ResultShell presentation={presentation} title={t("matches.results.title")}>
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
            <AppText style={styles.hint}>{attribution}</AppText>
          ) : null}
          {result.status === "unverified" ? (
            <AppText style={styles.hint}>
              {t("matches.results.unverifiedHint")}
            </AppText>
          ) : null}
        </>
      ) : null}

      {showAttendance ? (
        <View style={styles.section}>
          <AppText style={styles.prompt}>
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
        <View style={styles.section}>
          <View style={styles.intro}>
            <AppText style={styles.prompt}>
              {t("matches.results.submitPrompt")}
            </AppText>
            <AppText style={styles.hint}>
              {t("matches.results.optionalScoreHint")}
            </AppText>
          </View>
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
        <View style={styles.section}>
          <AppText style={styles.hint}>
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
        <View style={styles.section}>
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
        <View style={styles.section}>
          <AppText style={styles.hint}>
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
    </ResultShell>
  );
}

function ResultShell({
  presentation,
  title,
  children,
}: PropsWithChildren<{
  presentation: "section" | "plain";
  title: string;
}>) {
  if (presentation === "plain") {
    return <View style={styles.plainShell}>{children}</View>;
  }

  return <PlayerProfileSection title={title}>{children}</PlayerProfileSection>;
}

const styles = StyleSheet.create({
  plainShell: {
    gap: tennisSpacing.section,
  },
  section: {
    gap: 14,
  },
  intro: {
    gap: 6,
  },
  prompt: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 16,
    lineHeight: 22,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
  hint: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 19,
    color: tennisColors.mutedForeground,
  },
  scoreBlock: {
    width: "100%",
    gap: 10,
  },
  scoreHeaderRow: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  scoreColumnLabel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: tennisColors.mutedForeground,
    textAlign: "center",
  },
  scoreDashSpacer: {
    flexShrink: 0,
    width: 18,
  },
  setCard: {
    width: "100%",
    gap: 10,
    padding: 14,
    borderRadius: tennisRadii.lg,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.muted,
    overflow: "hidden",
  },
  setLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  scoreInputRow: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scoreInputWrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  scoreInput: {
    width: "100%",
    minHeight: 52,
    borderRadius: tennisRadii.md,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
    textAlign: "center",
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 22,
    color: tennisColors.primaryDark,
    paddingHorizontal: 8,
  },
  scoreInputDisabled: {
    opacity: 0.55,
  },
  scoreDash: {
    flexShrink: 0,
    width: 18,
    textAlign: "center",
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 18,
    color: tennisColors.mutedForeground,
  },
  setActions: {
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  setAction: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tennisRadii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  setActionPressed: {
    opacity: 0.8,
  },
  setActionDisabled: {
    opacity: 0.45,
  },
  setActionLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primary,
  },
  setActionLabelMuted: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  winnerPreview: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tennisRadii.md,
    backgroundColor: tennisColors.secondary,
  },
  winnerPreviewText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primary,
  },
  error: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.danger,
    lineHeight: 18,
    textAlign: "center",
  },
  subheading: {
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
  chips: {
    flexWrap: "wrap",
    gap: 8,
  },
  stack: {
    gap: 12,
  },
});
