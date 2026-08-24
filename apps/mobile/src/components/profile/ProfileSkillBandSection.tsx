import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OwnPlayerProfile } from "@tennis-lebanon/api";
import { setOwnSkillBand } from "@tennis-lebanon/api";
import {
  ORDERED_SKILL_BANDS,
  isProvisionalPlayerRating,
  setOwnSkillBandSchema,
  type SkillBand,
} from "@tennis-lebanon/domain";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { ChipButton } from "../onboarding-ui";
import { PlayerProfileSection } from "../player/PlayerProfileSection";
import { supabase } from "../../lib/supabase";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";

const VISIBLE_CHIP_COUNT = 3;

function clampStartIndex(index: number, bandIndex: number): number {
  const maxStart = Math.max(0, ORDERED_SKILL_BANDS.length - VISIBLE_CHIP_COUNT);
  let next = Math.max(0, Math.min(index, maxStart));
  if (bandIndex < next) {
    next = bandIndex;
  } else if (bandIndex > next + VISIBLE_CHIP_COUNT - 1) {
    next = bandIndex - VISIBLE_CHIP_COUNT + 1;
  }
  return Math.max(0, Math.min(next, maxStart));
}

export function ProfileSkillBandSection({
  playerProfile,
}: {
  playerProfile: OwnPlayerProfile;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { rowDirection } = useLayoutDirection();
  const [error, setError] = useState(false);
  const provisional = isProvisionalPlayerRating(
    playerProfile.rated_match_count,
  );
  const [skillBand, setSkillBand] = useState(
    playerProfile.skill_band as SkillBand,
  );
  const [startIndex, setStartIndex] = useState(() =>
    clampStartIndex(0, ORDERED_SKILL_BANDS.indexOf(skillBand)),
  );

  // Adjusting state during render rather than in an effect: React sanctions
  // this for prop-derived state, and the effect version renders once with the
  // stale band before correcting itself.
  const [syncedBand, setSyncedBand] = useState(playerProfile.skill_band);
  if (playerProfile.skill_band !== syncedBand) {
    setSyncedBand(playerProfile.skill_band);
    setSkillBand(playerProfile.skill_band as SkillBand);
  }

  const bandIndex = ORDERED_SKILL_BANDS.indexOf(skillBand);
  const maxStartIndex = Math.max(
    0,
    ORDERED_SKILL_BANDS.length - VISIBLE_CHIP_COUNT,
  );

  // Derived rather than synced through an effect: the selected band has to stay
  // inside the visible window, and doing that with setState in an effect
  // cascades a second render every time the band changes.
  const effectiveStart = clampStartIndex(startIndex, bandIndex);

  const visibleBands = useMemo(
    () =>
      ORDERED_SKILL_BANDS.slice(
        effectiveStart,
        effectiveStart + VISIBLE_CHIP_COUNT,
      ),
    [effectiveStart],
  );

  const saveMutation = useMutation({
    mutationFn: async (nextBand: SkillBand) => {
      const parsed = setOwnSkillBandSchema.safeParse({ skillBand: nextBand });
      if (!parsed.success) {
        throw new Error("invalid_skill_band");
      }
      await setOwnSkillBand(supabase, parsed.data.skillBand);
    },
    onSuccess: async () => {
      setError(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["own-player-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["own-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-matches"] }),
      ]);
    },
    onError: () => {
      setError(true);
      setSkillBand(playerProfile.skill_band as SkillBand);
    },
  });

  return (
    <PlayerProfileSection title={t("profile.skillBandTitle")}>
      <AppText style={tennisTextStyles.fieldHint}>
        {provisional
          ? t("profile.skillBandProvisionalHint")
          : t("profile.skillBandLockedHint")}
      </AppText>

      <View
        style={[
          styles.carousel,
          !provisional ? styles.carouselLocked : null,
          { flexDirection: rowDirection },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.skillBandScrollPrevious")}
          disabled={effectiveStart === 0}
          onPress={() => setStartIndex(Math.max(0, effectiveStart - 1))}
          style={({ pressed }) => [
            styles.arrow,
            effectiveStart === 0 && styles.arrowDisabled,
            pressed && effectiveStart > 0 && styles.arrowPressed,
          ]}
        >
          <Icon
            name="chevronBack"
            size={18}
            color={
              effectiveStart === 0
                ? tennisColors.mutedForeground
                : tennisColors.primary
            }
          />
        </Pressable>

        <View style={[styles.chipRow, { flexDirection: rowDirection }]}>
          {visibleBands.map((band) => (
            <ChipButton
              key={band}
              compact
              label={t(`skillBandsShort.${band}`)}
              selected={skillBand === band}
              disabled={!provisional}
              style={styles.chipCell}
              onPress={() => {
                if (band === skillBand || saveMutation.isPending) {
                  return;
                }
                setSkillBand(band);
                saveMutation.mutate(band);
              }}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.skillBandScrollNext")}
          disabled={effectiveStart >= maxStartIndex}
          onPress={() =>
            setStartIndex(Math.min(maxStartIndex, effectiveStart + 1))
          }
          style={({ pressed }) => [
            styles.arrow,
            effectiveStart >= maxStartIndex && styles.arrowDisabled,
            pressed && effectiveStart < maxStartIndex && styles.arrowPressed,
          ]}
        >
          <Icon
            name="chevron"
            size={18}
            color={
              effectiveStart >= maxStartIndex
                ? tennisColors.mutedForeground
                : tennisColors.primary
            }
          />
        </Pressable>
      </View>

      {error ? (
        <AppText style={styles.error}>
          {t("profile.skillBandUpdateError")}
        </AppText>
      ) : null}
    </PlayerProfileSection>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    carousel: {
      alignItems: "center",
      gap: 6,
    },
    carouselLocked: {
      opacity: 0.55,
    },
    arrow: {
      width: minTouchTargetPx,
      height: minTouchTargetPx,
      borderRadius: tennisRadii.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tennisColors.muted,
    },
    arrowDisabled: {
      opacity: 0.45,
    },
    arrowPressed: {
      opacity: 0.85,
    },
    chipRow: {
      flex: 1,
      gap: 6,
      minWidth: 0,
    },
    chipCell: {
      flex: 1,
      minWidth: 0,
    },
    error: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.accent,
    },
  }),
);
