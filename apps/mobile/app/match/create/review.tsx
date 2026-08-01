import { useEffect, useMemo, useState } from "react";
import { Alert, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createMatchDraft,
  getActiveZones,
  listMyMatches,
  publishMatch,
} from "@tennis-lebanon/api";
import type { CreateMatchInput } from "@tennis-lebanon/domain";
import {
  findActiveHostedMatch,
  formatSkillBandSelection,
  listOnDiscoverFromVisibility,
  ORDERED_SKILL_BANDS,
  skillBandsInRange,
} from "@tennis-lebanon/domain";
import { StatusBanner } from "../../../src/components/AppUi";
import { AppText } from "../../../src/components/AppText";
import {
  CreateMatchStepLayout,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  figmaFormStyles,
  onboardingInputStyle,
} from "../../../src/components/onboarding-ui";
import {
  ErrorNotice,
  SummaryRow,
  formStyles,
} from "../../../src/components/FormUi";
import { formatUtcSlotInBeirut } from "../../../src/lib/beirut-time";
import {
  CreateMatchSection,
  createMatchStyles,
} from "../../../src/lib/create-match-ui";
import { tennisColors } from "../../../src/theme/tennis-tokens";
import {
  buildCreateMatchInput,
  getCreateMatchDraft,
  isCreateMatchDraftReady,
  resetCreateMatchDraft,
} from "../../../src/lib/create-match-draft";
import { matchHubRoute, matchInviteRoute } from "../../../src/lib/routes";
import { zoneNameFromJson } from "../../../src/lib/zones";
import { supabase } from "../../../src/lib/supabase";

type PublishDestination = "invite" | "hub";

type PublishVariables = {
  destination: PublishDestination;
  input: CreateMatchInput;
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
    default:
      return t("matches.create.reviewValidationError");
  }
}

export default function CreateMatchReviewScreen() {
  const { t, i18n } = useTranslation();
  const draft = getCreateMatchDraft();
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [publishError, setPublishError] = useState<string | null>(null);

  const zonesQuery = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const myMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });

  const activeHostedMatch = useMemo(
    () =>
      draft.format
        ? findActiveHostedMatch(myMatchesQuery.data ?? [], draft.format)
        : undefined,
    [draft.format, myMatchesQuery.data],
  );

  const zoneLabels = useMemo(() => {
    if (!draft.zoneIds?.length || !zonesQuery.data) return "";
    return draft.zoneIds
      .map((zoneId) => {
        const zone = zonesQuery.data.find((entry) => entry.id === zoneId);
        if (!zone) return "";
        return zoneNameFromJson(
          zone.name_i18n,
          i18n.resolvedLanguage ?? i18n.language,
        );
      })
      .filter(Boolean)
      .join(", ");
  }, [draft.zoneIds, i18n.language, i18n.resolvedLanguage, zonesQuery.data]);

  const levelSummary = useMemo(() => {
    const selected =
      draft.selectedSkillBands && draft.selectedSkillBands.length > 0
        ? draft.selectedSkillBands
        : draft.minSkill && draft.maxSkill
          ? skillBandsInRange(draft.minSkill, draft.maxSkill)
          : [];

    if (selected.length === ORDERED_SKILL_BANDS.length) {
      return t("matches.create.allLevels");
    }

    return formatSkillBandSelection(selected, (band) =>
      t(`skillBandsShort.${band}`),
    );
  }, [draft.maxSkill, draft.minSkill, draft.selectedSkillBands, t]);

  const matchTypeSummary = useMemo(() => {
    if (!draft.format || !draft.intent) return "";
    return `${t(`formats.${draft.format}`)} · ${t(`playIntent.${draft.intent}`)}`;
  }, [draft.format, draft.intent, t]);

  const joinSettingsSummary = useMemo(() => {
    const listed = listOnDiscoverFromVisibility(draft.visibility);
    const parts = [
      listed
        ? t("matches.create.summaryDiscover")
        : t("matches.create.summaryInviteOnly"),
    ];

    if (draft.requiresCreatorApproval && listed) {
      parts.push(t("matches.create.summaryApproval"));
    }

    return parts.join(" · ");
  }, [draft.requiresCreatorApproval, draft.visibility, t]);

  const proposedTimeLabel = useMemo(() => {
    const slot = draft.proposedTimes?.[0];
    if (!slot) return "";
    return formatUtcSlotInBeirut(slot.startsAt, slot.endsAt);
  }, [draft.proposedTimes]);

  useEffect(() => {
    const current = getCreateMatchDraft();
    if (!isCreateMatchDraftReady(current)) {
      router.replace("/match/create/details");
    }
  }, []);

  const publishMutation = useMutation({
    mutationFn: async ({ destination, input }: PublishVariables) => {
      const matchId = await createMatchDraft(supabase, input);
      if (destination === "hub") {
        await publishMatch(supabase, matchId);
      }
      return matchId;
    },
    onSuccess: (matchId, { destination }) => {
      if (typeof matchId !== "string" || matchId.length === 0) {
        setPublishError(t("matches.create.publishError"));
        return;
      }

      resetCreateMatchDraft();
      router.replace(
        destination === "invite"
          ? matchInviteRoute(matchId)
          : matchHubRoute(matchId),
      );
    },
    onError: (error) => {
      if (isActiveHostedMatchError(error)) {
        Alert.alert(
          t("matches.create.activeHostedTitle"),
          t("matches.create.activeHostedBody", {
            format: t(`formats.${draft.format}`),
          }),
        );
        return;
      }

      setPublishError(t("matches.create.publishError"));
      Alert.alert(t("matches.create.publishError"));
    },
  });

  function goToActiveHostedMatch() {
    if (!activeHostedMatch) return;
    if (activeHostedMatch.status === "draft") {
      router.replace(matchInviteRoute(activeHostedMatch.match_id));
      return;
    }
    router.replace(matchHubRoute(activeHostedMatch.match_id));
  }

  function publish(destination: PublishDestination) {
    setPublishError(null);

    if (activeHostedMatch) {
      Alert.alert(
        t("matches.create.activeHostedTitle"),
        t("matches.create.activeHostedBody", {
          format: t(`formats.${draft.format}`),
        }),
      );
      return;
    }

    const built = buildCreateMatchInput(notes);
    if (!built.success) {
      const message = publishValidationMessage(built.error, t);
      setPublishError(message);
      Alert.alert(t("matches.create.reviewTitle"), message);
      return;
    }

    publishMutation.mutate({ destination, input: built.data });
  }

  if (!draft.format) {
    return null;
  }

  return (
    <CreateMatchStepLayout
      title={t("matches.create.reviewTitle")}
      step={3}
      totalSteps={3}
      onBack={() => router.back()}
      footer={
        <>
          {publishError ? <ErrorNotice>{publishError}</ErrorNotice> : null}
          <AppText style={formStyles.hintText}>
            {t("matches.create.reviewActionsHint")}
          </AppText>
          <FigmaPrimaryButton
            label={t("matches.invite.invitePlayers")}
            loading={publishMutation.isPending}
            onPress={() => publish("invite")}
          />
          <FigmaSecondaryButton
            label={t("matches.create.publish")}
            disabled={publishMutation.isPending}
            onPress={() => publish("hub")}
          />
        </>
      }
    >
      {activeHostedMatch ? (
        <StatusBanner
          body={t("matches.create.activeHostedBody", {
            format: t(`formats.${draft.format}`),
          })}
          actions={
            <>
              <FigmaPrimaryButton
                label={t("matches.create.continueInviting")}
                onPress={goToActiveHostedMatch}
              />
              <FigmaSecondaryButton
                label={t("matches.hub.cancel")}
                onPress={() =>
                  router.replace(matchHubRoute(activeHostedMatch.match_id))
                }
              />
            </>
          }
        />
      ) : null}

      <View style={figmaFormStyles.stack}>
        <CreateMatchSection label={t("matches.create.reviewSummary")}>
          <View style={formStyles.compactCard}>
            <SummaryRow
              label={t("matches.create.summaryType")}
              value={matchTypeSummary}
            />
            <SummaryRow
              label={t("matches.create.matchLevel")}
              value={levelSummary}
            />
            <SummaryRow
              label={t("matches.create.summaryJoin")}
              value={joinSettingsSummary}
            />
            <SummaryRow
              label={t("matches.create.summaryWhere")}
              value={zoneLabels}
            />
            <SummaryRow
              label={t("matches.create.summaryWhen")}
              value={proposedTimeLabel}
            />
          </View>
        </CreateMatchSection>

        <CreateMatchSection label={t("matches.create.notes")}>
          <TextInput
            accessibilityLabel={t("matches.create.notes")}
            multiline
            placeholderTextColor={tennisColors.mutedForeground}
            style={[onboardingInputStyle.input, createMatchStyles.notesInput]}
            value={notes}
            onChangeText={setNotes}
          />
        </CreateMatchSection>
      </View>
    </CreateMatchStepLayout>
  );
}
