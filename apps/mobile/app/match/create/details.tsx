import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { listMyMatches } from "@tennis-lebanon/api";
import { skillBandsForPlayer } from "@tennis-lebanon/domain";
import {
  findActiveHostedMatch,
  ORDERED_SKILL_BANDS,
  skillBandsInRange,
  skillRangeFromSelection,
  toggleSkillBandSelection,
  type PlayIntent,
  type SkillBand,
} from "@tennis-lebanon/domain";
import { StatusBanner } from "../../../src/components/AppUi";
import { LevelRangePicker } from "../../../src/components/LevelRangePicker";
import {
  CreateMatchStepLayout,
  FigmaChipRow,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  figmaFormStyles,
} from "../../../src/components/onboarding-ui";
import {
  getCreateMatchDraft,
  updateCreateMatchDraft,
} from "../../../src/lib/create-match-draft";
import {
  CreateMatchPanel,
  CreateMatchSection,
} from "../../../src/lib/create-match-ui";
import { activeHostedContinueRoute } from "../../../src/lib/create-match-guard";
import { confirmCancelHostedMatch } from "../../../src/lib/confirm-cancel-hosted-match";
import { useAuth } from "../../../src/providers/AuthProvider";
import { supabase } from "../../../src/lib/supabase";

type MatchFormat = "singles" | "doubles";

/**
 * Bands the draft already carries, or null when the host has not chosen yet.
 * Null defers to {@link defaultSelectedBands}, which needs the host's own band
 * and therefore cannot be resolved at first render.
 */
function draftSelectedBands(
  draft: ReturnType<typeof getCreateMatchDraft>,
): SkillBand[] | null {
  if (draft.selectedSkillBands?.length) {
    return draft.selectedSkillBands;
  }

  if (draft.minSkill && draft.maxSkill) {
    return skillBandsInRange(draft.minSkill, draft.maxSkill);
  }

  return null;
}

/**
 * A host who accepts the default should get a match they can play in.
 *
 * This used to be a hardcoded improving–intermediate, so an advanced host
 * published a listing nobody at their own level could find — discovery filters
 * on level overlap, and the host is auto-joined regardless, so nothing surfaced
 * the mismatch. Falls back to the old pair only while the band is still loading
 * or the player has none.
 */
function defaultSelectedBands(myBand: SkillBand | null | undefined) {
  return myBand
    ? skillBandsForPlayer(myBand)
    : skillBandsInRange("improving", "intermediate");
}

export default function CreateMatchDetailsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const draft = getCreateMatchDraft();
  const [format, setFormat] = useState<MatchFormat>(draft.format ?? "singles");
  const [intent, setIntent] = useState<PlayIntent>(draft.intent ?? "either");
  const [selectedBands, setSelectedBands] = useState<SkillBand[] | null>(() =>
    draftSelectedBands(draft),
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

  // Derived rather than seeded in an effect: the host's band arrives async, and
  // setting state from an effect cascades a second render on every load.
  const effectiveBands = useMemo(
    () => selectedBands ?? defaultSelectedBands(skillBandQuery.data),
    [selectedBands, skillBandQuery.data],
  );

  useEffect(() => {
    const { minSkill, maxSkill } = skillRangeFromSelection(effectiveBands);
    updateCreateMatchDraft({
      format,
      intent,
      minSkill,
      maxSkill,
      selectedSkillBands: effectiveBands,
    });
  }, [format, intent, effectiveBands]);

  function goToActiveHostedMatch() {
    if (!activeHostedMatch) return;
    router.replace(
      activeHostedContinueRoute({
        matchId: activeHostedMatch.match_id,
        format: activeHostedMatch.format as "singles" | "doubles",
        status: activeHostedMatch.status,
      }),
    );
  }

  function handleDone() {
    router.back();
  }

  return (
    <CreateMatchStepLayout
      title={t("matches.create.overridesTitle")}
      description={t("matches.create.overridesDescription")}
      onBack={() => router.back()}
      footer={
        <FigmaPrimaryButton
          label={t("matches.create.overridesDone")}
          onPress={handleDone}
        />
      }
    >
      {draft.inviteForPlayer && draft.targetPlayerName ? (
        <StatusBanner
          body={t("matches.create.forPlayerHint", {
            name: draft.targetPlayerName,
          })}
        />
      ) : null}

      {activeHostedMatch ? (
        <StatusBanner
          body={t("matches.create.activeHostedBody", {
            format: t(`formats.${format}`),
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
                  confirmCancelHostedMatch(
                    {
                      matchId: activeHostedMatch.match_id,
                      status: activeHostedMatch.status,
                      participantCount: activeHostedMatch.participant_count,
                      bookingStartsAt: activeHostedMatch.court_starts_at,
                    },
                    t,
                    () => myMatchesQuery.refetch(),
                  )
                }
              />
            </>
          }
        />
      ) : null}

      <View style={figmaFormStyles.stack}>
        <CreateMatchPanel title={t("matches.create.matchTypeSection")}>
          <CreateMatchSection label={t("discover.formatFilter")}>
            <FigmaChipRow
              value={format}
              options={(["singles", "doubles"] as const).map((value) => ({
                value,
                label: t(`formats.${value}`),
              }))}
              onChange={setFormat}
            />
          </CreateMatchSection>

          <CreateMatchSection label={t("discover.intentFilter")}>
            <FigmaChipRow
              value={intent}
              options={(["social", "competitive", "either"] as const).map(
                (value) => ({
                  value,
                  label: t(`playIntent.${value}`),
                }),
              )}
              onChange={setIntent}
            />
          </CreateMatchSection>
        </CreateMatchPanel>

        <CreateMatchPanel title={t("matches.create.matchLevel")}>
          <LevelRangePicker
            bands={levelOptions}
            selected={effectiveBands}
            onToggle={(band) =>
              setSelectedBands(toggleSkillBandSelection(effectiveBands, band))
            }
            yourLevel={skillBandQuery.data}
            yourLevelLabel={t("matches.create.yourLevel")}
          />
        </CreateMatchPanel>
      </View>
    </CreateMatchStepLayout>
  );
}
