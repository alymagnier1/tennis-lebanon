import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OwnPlayerProfile } from "@tennis-lebanon/api";
import { updateTennisPreferences } from "@tennis-lebanon/api";
import {
  type PlayIntent,
  updateTennisPreferencesSchema,
} from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { ChipButton } from "../onboarding-ui";
import { PlayerProfileSection } from "../player/PlayerProfileSection";
import {
  profileScreenMatchFormatsLabel,
  profileScreenPlayIntentLabel,
  profileScreenTennisPrefsTitle,
} from "../../lib/profile-screen-copy";
import { supabase } from "../../lib/supabase";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";

const intents: PlayIntent[] = ["social", "competitive", "either"];

export function ProfileTennisPreferencesSection({
  playerProfile,
}: {
  playerProfile: OwnPlayerProfile;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { rowDirection } = useLayoutDirection();
  const [formatError, setFormatError] = useState(false);

  const [playIntent, setPlayIntent] = useState<PlayIntent>(
    playerProfile.play_intent as PlayIntent,
  );
  const [prefersSingles, setPrefersSingles] = useState(
    playerProfile.prefers_singles,
  );
  const [prefersDoubles, setPrefersDoubles] = useState(
    playerProfile.prefers_doubles,
  );

  const [syncedProfile, setSyncedProfile] = useState(playerProfile);

  // Re-seed the form when the saved profile changes. Adjusted during render
  // rather than in an effect, which would cause a cascading second render.
  if (playerProfile !== syncedProfile) {
    setSyncedProfile(playerProfile);
    setPlayIntent(playerProfile.play_intent as PlayIntent);
    setPrefersSingles(playerProfile.prefers_singles);
    setPrefersDoubles(playerProfile.prefers_doubles);
  }

  const saveMutation = useMutation({
    mutationFn: async (next: {
      playIntent: PlayIntent;
      prefersSingles: boolean;
      prefersDoubles: boolean;
    }) => {
      const parsed = updateTennisPreferencesSchema.safeParse({
        playIntent: next.playIntent,
        prefersSingles: next.prefersSingles,
        prefersDoubles: next.prefersDoubles,
      });

      if (!parsed.success) {
        setFormatError(true);
        throw new Error("Invalid tennis preferences");
      }

      setFormatError(false);
      await updateTennisPreferences(supabase, parsed.data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["own-player-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-matches"] }),
      ]);
    },
  });

  const persist = (next: {
    playIntent: PlayIntent;
    prefersSingles: boolean;
    prefersDoubles: boolean;
  }) => {
    saveMutation.mutate(next);
  };

  return (
    <PlayerProfileSection title={profileScreenTennisPrefsTitle(t)}>
      <AppText style={styles.subheading}>
        {profileScreenPlayIntentLabel(t)}
      </AppText>
      <View style={[styles.chips, { flexDirection: rowDirection }]}>
        {intents.map((intent) => (
          <ChipButton
            key={intent}
            label={t(`playIntent.${intent}`)}
            selected={playIntent === intent}
            onPress={() => {
              setPlayIntent(intent);
              persist({
                playIntent: intent,
                prefersSingles,
                prefersDoubles,
              });
            }}
          />
        ))}
      </View>

      <AppText style={styles.subheading}>
        {profileScreenMatchFormatsLabel(t)}
      </AppText>
      <View style={[styles.chips, { flexDirection: rowDirection }]}>
        <ChipButton
          label={t("formats.singles")}
          selected={prefersSingles}
          onPress={() => {
            const nextSingles = !prefersSingles;
            if (!nextSingles && !prefersDoubles) {
              setFormatError(true);
              return;
            }
            setPrefersSingles(nextSingles);
            persist({
              playIntent,
              prefersSingles: nextSingles,
              prefersDoubles,
            });
          }}
        />
        <ChipButton
          label={t("formats.doubles")}
          selected={prefersDoubles}
          onPress={() => {
            const nextDoubles = !prefersDoubles;
            if (!nextDoubles && !prefersSingles) {
              setFormatError(true);
              return;
            }
            setPrefersDoubles(nextDoubles);
            persist({
              playIntent,
              prefersSingles,
              prefersDoubles: nextDoubles,
            });
          }}
        />
      </View>

      {formatError ? (
        <AppText style={styles.error}>
          {t("onboarding.tennis.formatError")}
        </AppText>
      ) : null}
    </PlayerProfileSection>
  );
}

const styles = StyleSheet.create({
  subheading: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  chips: {
    flexWrap: "wrap",
    gap: 8,
  },
  error: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.accent,
  },
});
