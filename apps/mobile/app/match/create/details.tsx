import { useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { listMyMatches } from "@tennis-lebanon/api";
import {
  findActiveHostedMatch,
  listOnDiscoverFromVisibility,
  ORDERED_SKILL_BANDS,
  skillBandsInRange,
  skillRangeFromSelection,
  toggleSkillBandSelection,
  visibilityFromListOnDiscover,
  type PlayIntent,
  type SkillBand,
} from "@tennis-lebanon/domain";
import {
  ChipSelect,
  FormSection,
  SettingToggle,
  StatusBanner,
  WizardProgress,
} from "../../../src/components/AppUi";
import { LevelRangePicker } from "../../../src/components/LevelRangePicker";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../../src/components/FormUi";
import {
  getCreateMatchDraft,
  updateCreateMatchDraft,
} from "../../../src/lib/create-match-draft";
import { matchInviteRoute } from "../../../src/lib/routes";
import { useAuth } from "../../../src/providers/AuthProvider";
import { supabase } from "../../../src/lib/supabase";

type MatchFormat = "singles" | "doubles";

function initialSelectedBands(draft: ReturnType<typeof getCreateMatchDraft>) {
  if (draft.selectedSkillBands?.length) {
    return draft.selectedSkillBands;
  }

  if (draft.minSkill && draft.maxSkill) {
    return skillBandsInRange(draft.minSkill, draft.maxSkill);
  }

  return skillBandsInRange("improving", "intermediate");
}

export default function CreateMatchDetailsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const draft = getCreateMatchDraft();
  const [format, setFormat] = useState<MatchFormat>(draft.format ?? "singles");
  const [intent, setIntent] = useState<PlayIntent>(draft.intent ?? "either");
  const [selectedBands, setSelectedBands] = useState<SkillBand[]>(() =>
    initialSelectedBands(draft),
  );
  const [listOnDiscover, setListOnDiscover] = useState(() =>
    listOnDiscoverFromVisibility(draft.visibility),
  );
  const [requiresApproval, setRequiresApproval] = useState(
    draft.requiresCreatorApproval ?? false,
  );

  const skillBandQuery = useQuery({
    queryKey: ["my-skill-band", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_profiles")
        .select("skill_band")
        .eq("user_id", session!.user.id)
        .maybeSingle();

      if (error) throw error;
      return (data?.skill_band as SkillBand | null) ?? null;
    },
    enabled: Boolean(session?.user.id),
  });

  const myMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });

  const activeHostedMatch = useMemo(
    () => findActiveHostedMatch(myMatchesQuery.data ?? [], format),
    [format, myMatchesQuery.data],
  );

  const levelOptions = useMemo(
    () =>
      ORDERED_SKILL_BANDS.map((band) => ({
        value: band,
        label: t(`skillBands.${band}`),
      })),
    [t],
  );

  useEffect(() => {
    const { minSkill, maxSkill } = skillRangeFromSelection(selectedBands);
    updateCreateMatchDraft({
      format,
      intent,
      minSkill,
      maxSkill,
      selectedSkillBands: selectedBands,
      visibility: visibilityFromListOnDiscover(listOnDiscover),
      requiresCreatorApproval: requiresApproval,
    });
  }, [
    format,
    intent,
    listOnDiscover,
    requiresApproval,
    selectedBands,
  ]);

  function goToActiveHostedMatch() {
    if (!activeHostedMatch) return;
    router.replace(matchInviteRoute(activeHostedMatch.match_id));
  }

  function handleNext() {
    if (activeHostedMatch) {
      Alert.alert(
        t("matches.create.activeHostedTitle"),
        t("matches.create.activeHostedBody", {
          format: t(`formats.${format}`),
        }),
      );
      return;
    }

    router.push("/match/create/schedule");
  }

  return (
    <Screen
      title={t("matches.create.title")}
      showTitle={false}
      description={t("matches.create.wizardStep1Description")}
    >
      <WizardProgress step={1} totalSteps={3} />

      {activeHostedMatch ? (
        <StatusBanner
          body={t("matches.create.activeHostedBody", {
            format: t(`formats.${format}`),
          })}
          actions={
            <>
              <PrimaryButton
                label={t("matches.create.continueInviting")}
                onPress={goToActiveHostedMatch}
              />
              <SecondaryButton
                label={t("matches.hub.cancel")}
                onPress={() =>
                  router.push({
                    pathname: "/match/[id]",
                    params: { id: activeHostedMatch.match_id },
                  })
                }
              />
            </>
          }
        />
      ) : null}

      <View style={formStyles.stack}>
        <FormSection
          title={t("matches.create.matchTypeSection")}
          subtitle={t("matches.create.matchTypeDescription")}
        >
          <ChipSelect
            label={t("discover.formatFilter")}
            value={format}
            options={(["singles", "doubles"] as const).map((value) => ({
              value,
              label: t(`formats.${value}`),
            }))}
            onChange={setFormat}
          />
          <ChipSelect
            label={t("discover.intentFilter")}
            value={intent}
            options={(["social", "competitive", "either"] as const).map(
              (value) => ({
                value,
                label: t(`playIntent.${value}`),
              }),
            )}
            onChange={setIntent}
          />
        </FormSection>

        <FormSection title={t("matches.create.matchLevel")}>
          <LevelRangePicker
            bands={levelOptions}
            selected={selectedBands}
            onToggle={(band) =>
              setSelectedBands((current) =>
                toggleSkillBandSelection(current, band),
              )
            }
            yourLevel={skillBandQuery.data}
            yourLevelLabel={t("matches.create.yourLevel")}
          />
        </FormSection>

        <FormSection
          title={t("matches.create.joinSettingsSection")}
          subtitle={t("matches.create.joinSettingsDescription")}
        >
          <SettingToggle
            label={t("matches.create.listOnDiscover")}
            description={t("matches.create.listOnDiscoverHint")}
            value={listOnDiscover}
            onValueChange={(value) => {
              setListOnDiscover(value);
              if (!value) {
                setRequiresApproval(false);
              }
            }}
          />
          <SettingToggle
            label={t("matches.create.requiresApprovalShort")}
            description={t("matches.create.requiresApprovalHint")}
            value={requiresApproval}
            onValueChange={setRequiresApproval}
            disabled={!listOnDiscover}
          />
        </FormSection>
      </View>

      <PrimaryButton
        label={t("common.continue")}
        disabled={Boolean(activeHostedMatch)}
        onPress={handleNext}
      />
    </Screen>
  );
}
