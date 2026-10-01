import { useState } from "react";
import { StyleSheet, View } from "react-native";
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
import { AppText } from "../AppText";
import { ChipButton } from "../onboarding-ui";
import { PlayerProfileSection } from "../player/PlayerProfileSection";
import { supabase } from "../../lib/supabase";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";

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

  // Adjusting state during render rather than in an effect: React sanctions
  // this for prop-derived state, and the effect version renders once with the
  // stale band before correcting itself.
  const [syncedBand, setSyncedBand] = useState(playerProfile.skill_band);
  if (playerProfile.skill_band !== syncedBand) {
    setSyncedBand(playerProfile.skill_band);
    setSkillBand(playerProfile.skill_band as SkillBand);
  }

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

      {/* All five levels, wrapping onto two lines. Three at a time between
          arrows left each chip about 68pt, and "Intermediate" was cut off
          with an ellipsis (founder, 2026-09-28). */}
      <View
        style={[
          styles.chips,
          !provisional ? styles.chipsLocked : null,
          { flexDirection: rowDirection },
        ]}
      >
        {ORDERED_SKILL_BANDS.map((band) => (
          <ChipButton
            key={band}
            compact
            label={t(`skillBandsShort.${band}`)}
            selected={skillBand === band}
            disabled={!provisional}
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
    chips: {
      flexWrap: "wrap",
      gap: 8,
    },
    chipsLocked: {
      opacity: 0.55,
    },
    error: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.accent,
    },
  }),
);
