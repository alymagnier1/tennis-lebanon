import { Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getOwnPlayerProfile } from "@tennis-lebanon/api";
import {
  formatOwnRatingHeadline,
  isProvisionalPlayerRating,
} from "@tennis-lebanon/domain";
import { PrimaryButton, Screen, formStyles } from "../../src/components/FormUi";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "../../src/lib/supabase";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const playerProfileQuery = useQuery({
    queryKey: ["own-player-profile", session?.user.id],
    queryFn: () => getOwnPlayerProfile(supabase),
    enabled: Boolean(session),
  });
  const playerProfile = playerProfileQuery.data;

  const ratingHeadline = playerProfile
    ? formatOwnRatingHeadline({
        ratedMatchCount: playerProfile.rated_match_count,
        internalRating: playerProfile.internal_rating,
        translateEarned: (value) => t("rating.ownEarned", { value }),
        translateProvisional: (count, threshold) =>
          t("rating.ownProvisional", { count, threshold }),
      })
    : null;

  return (
    <Screen
      title={profile?.display_name ?? t("profile.title")}
      description={
        playerProfile && isProvisionalPlayerRating(playerProfile.rated_match_count)
          ? t("rating.progressHint")
          : undefined
      }
    >
      <View style={formStyles.summary}>
        {playerProfile ? (
          <>
            <Text style={formStyles.summaryLabel}>{t("rating.ownBand")}</Text>
            <Text style={formStyles.summaryValue}>
              {t(`skillBands.${playerProfile.skill_band}`)}
            </Text>
            <Text style={formStyles.summaryLabel}>{t("rating.ownRatingLabel")}</Text>
            <Text style={formStyles.summaryValue}>
              {ratingHeadline ?? t("discover.loading")}
            </Text>
          </>
        ) : null}
        <Text style={formStyles.summaryLabel}>{t("profile.languages")}</Text>
        <Text style={formStyles.summaryValue}>
          {profile?.languages.join(", ").toUpperCase()}
        </Text>
        <Text style={formStyles.summaryLabel}>{t("profile.adultStatus")}</Text>
        <Text style={formStyles.summaryValue}>
          {profile?.is_adult_confirmed
            ? t("profile.confirmed")
            : t("profile.incomplete")}
        </Text>
      </View>
      <PrimaryButton
        label={t("profile.availability")}
        onPress={() => router.push("/profile/availability")}
      />
      <PrimaryButton
        label={t("settings.title")}
        onPress={() => router.push("/(tabs)/settings")}
      />
    </Screen>
  );
}
