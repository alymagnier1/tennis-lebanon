import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getActiveZones,
  listOwnPreferredZoneIds,
  setClubFavorite,
  updatePreferredZones,
} from "@tennis-lebanon/api";
import { updatePreferredZonesSchema } from "@tennis-lebanon/domain";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import { FavoriteClubToggleList } from "../../src/components/profile/FavoriteClubToggleList";
import {
  ChipButton,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  FigmaTextButton,
  figmaFormStyles,
  OnboardingStepLayout,
} from "../../src/components/onboarding-ui";
import { useClubsDirectory } from "../../src/hooks/useClubsDirectory";
import { CreateMatchPanel } from "../../src/lib/create-match-ui";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import {
  profileScreenPreferredAreasTitle,
  profileScreenZonesError,
} from "../../src/lib/profile-screen-copy";
import { CLUBS_ROUTE } from "../../src/lib/routes";
import { supabase } from "../../src/lib/supabase";
import { zoneNameFromJson } from "../../src/lib/zones";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

export default function WhereIPlayScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  // Reached straight after onboarding completes. The club RPCs reject callers
  // whose onboarding_completed_at is null, so this cannot be an onboarding
  // step — it runs here instead, where favourites can actually be written.
  const { firstRun } = useLocalSearchParams<{ firstRun?: string }>();
  const isFirstRun = firstRun === "1";
  const { rowDirection } = useLayoutDirection();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneError, setZoneError] = useState(false);
  const [syncedZones, setSyncedZones] = useState<string[] | undefined>(
    undefined,
  );
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);

  const zonesQuery = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const ownZonesQuery = useQuery({
    queryKey: ["own-zone-ids"],
    queryFn: () => listOwnPreferredZoneIds(supabase),
  });

  if (ownZonesQuery.data && ownZonesQuery.data !== syncedZones) {
    setSyncedZones(ownZonesQuery.data);
    setSelectedZoneIds(ownZonesQuery.data);
  }

  const clubsQuery = useClubsDirectory(
    selectedZoneIds.length > 0 ? selectedZoneIds : undefined,
  );

  const favoriteCount =
    clubsQuery.data?.filter((club) => club.is_favorite).length ?? 0;

  const saveZonesMutation = useMutation({
    mutationFn: async (zoneIds: string[]) => {
      const parsed = updatePreferredZonesSchema.safeParse({ zoneIds });
      if (!parsed.success) {
        setZoneError(true);
        throw new Error("Invalid preferred zones");
      }

      setZoneError(false);
      await updatePreferredZones(supabase, parsed.data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["own-zone-ids"] }),
        queryClient.invalidateQueries({ queryKey: ["own-zones"] }),
        queryClient.invalidateQueries({ queryKey: ["own-preferred-zones"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-matches"] }),
        queryClient.invalidateQueries({ queryKey: ["clubs-directory"] }),
      ]);
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({
      clubId,
      favorite,
    }: {
      clubId: string;
      favorite: boolean;
    }) => {
      setPendingClubId(clubId);
      await setClubFavorite(supabase, clubId, favorite);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clubs-directory"] });
    },
    onError: () => {
      Alert.alert(t("clubs.favoriteError"));
    },
    onSettled: () => {
      setPendingClubId(null);
    },
  });

  const toggleZone = (zoneId: string) => {
    const next = selectedZoneIds.includes(zoneId)
      ? selectedZoneIds.filter((id) => id !== zoneId)
      : [...selectedZoneIds, zoneId];

    if (next.length === 0) {
      setZoneError(true);
      return;
    }

    setSelectedZoneIds(next);
    saveZonesMutation.mutate(next);
  };

  const zonesLoading = zonesQuery.isLoading || ownZonesQuery.isLoading;

  return (
    <OnboardingStepLayout
      title={
        isFirstRun
          ? t("profile.whereIPlay.firstRunTitle")
          : t("profile.whereIPlay.title")
      }
      description={
        isFirstRun
          ? t("profile.whereIPlay.firstRunDescription")
          : t("profile.whereIPlay.description")
      }
      onBack={isFirstRun ? undefined : () => router.back()}
      footer={
        isFirstRun ? (
          <>
            <FigmaPrimaryButton
              label={t("common.done")}
              onPress={() => router.replace("/")}
            />
            <FigmaSecondaryButton
              label={t("profile.whereIPlay.firstRunSkip")}
              onPress={() => router.replace("/")}
            />
          </>
        ) : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={figmaFormStyles.stack}>
          <CreateMatchPanel
            title={profileScreenPreferredAreasTitle(t)}
            description={t("profile.whereIPlay.areasHint")}
          >
            {zonesLoading ? (
              <ActivityIndicator color={tennisColors.primary} />
            ) : null}
            {zonesQuery.isError || ownZonesQuery.isError ? (
              <ErrorNotice>{t("onboarding.zones.loadError")}</ErrorNotice>
            ) : null}
            {!zonesLoading && zonesQuery.data?.length === 0 ? (
              <AppText style={styles.muted}>
                {t("onboarding.zones.empty")}
              </AppText>
            ) : null}
            <View style={[styles.chips, { flexDirection: rowDirection }]}>
              {zonesQuery.data?.map((zone) => (
                <ChipButton
                  key={zone.id}
                  label={zoneNameFromJson(zone.name_i18n, locale)}
                  selected={selectedZoneIds.includes(zone.id)}
                  onPress={() => toggleZone(zone.id)}
                />
              ))}
            </View>
            {zoneError ? (
              <AppText style={styles.error}>
                {profileScreenZonesError(t)}
              </AppText>
            ) : null}
          </CreateMatchPanel>

          <CreateMatchPanel
            title={t("profile.whereIPlay.clubsSection")}
            description={t("profile.whereIPlay.clubsHint")}
          >
            {favoriteCount > 0 ? (
              <AppText style={styles.summary}>
                {t("profile.whereIPlay.favoriteCount", { count: favoriteCount })}
              </AppText>
            ) : null}

            {selectedZoneIds.length === 0 ? (
              <AppText style={styles.muted}>
                {t("profile.whereIPlay.pickAreaFirst")}
              </AppText>
            ) : (
              <FavoriteClubToggleList
                clubs={clubsQuery.data ?? []}
                loading={clubsQuery.isLoading}
                pendingClubId={pendingClubId}
                onToggleFavorite={(clubId, favorite) =>
                  favoriteMutation.mutate({ clubId, favorite })
                }
              />
            )}

            <View style={styles.browseRow}>
              <FigmaTextButton
                label={t("profile.whereIPlay.browseClubs")}
                onPress={() => router.push(CLUBS_ROUTE)}
              />
            </View>
          </CreateMatchPanel>
        </View>
      </ScrollView>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  summary: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.primary,
  },
  chips: {
    flexWrap: "wrap",
    gap: 8,
  },
  muted: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
  error: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.accent,
  },
  browseRow: {
    alignItems: "center",
  },
});
