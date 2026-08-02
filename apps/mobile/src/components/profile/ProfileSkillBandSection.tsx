import { useState } from "react";
import { StyleSheet, View } from "react-native";
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
  const [syncedProfile, setSyncedProfile] = useState(playerProfile);

  if (playerProfile !== syncedProfile) {
    setSyncedProfile(playerProfile);
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
      // The chip was selected optimistically. Nothing invalidates on failure,
      // so without this the UI keeps showing a band the server never accepted
      // until the profile happens to refetch.
      setSkillBand(playerProfile.skill_band as SkillBand);
    },
  });

  return (
    <PlayerProfileSection title={t("profile.skillBandTitle")}>
      <AppText style={styles.hint}>
        {provisional
          ? t("profile.skillBandProvisionalHint")
          : t("profile.skillBandLockedHint")}
      </AppText>

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
            label={t(`skillBands.${band}`)}
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

const styles = StyleSheet.create({
  hint: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
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
});
