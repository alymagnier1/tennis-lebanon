import { useState } from "react";
import { notify } from "../../lib/confirm-action";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearOwnAvatar,
  getOwnPlayerProfile,
  listMyCompletedMatches,
} from "@tennis-lebanon/api";
import { isProvisionalPlayerRating } from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { PlayerProfileSection } from "../player/PlayerProfileSection";
import { FigmaPrimaryButton } from "../onboarding-ui";
import { OwnProfileHero } from "./OwnProfileHero";
import { ProfileBioEditor } from "./ProfileBioEditor";
import { ProfileMenuRow } from "./ProfileMenuRow";
import { ProfileSettingsFab } from "./ProfileSettingsFab";
import { ProfileSkillBandSection } from "./ProfileSkillBandSection";
import { useAuth } from "../../providers/AuthProvider";
import { pickAndUploadOwnAvatar } from "../../lib/pick-own-avatar";
import {
  profileScreenAboutTitle,
  profileScreenEditLabel,
  profileScreenMatchesStatLabel,
  profileScreenRatingStatHint,
  profileScreenRatingStatValue,
} from "../../lib/profile-screen-copy";
import { supabase } from "../../lib/supabase";
import { CLUBS_ROUTE } from "../../lib/routes";
import { zoneLabelFromList } from "../../lib/zones";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

async function fetchOwnZones() {
  const { data, error } = await supabase
    .from("player_zones")
    .select("priority, zones(id, slug, name_i18n)")
    .order("priority");

  if (error) throw error;

  return (data ?? []).map((row) => row.zones);
}

export function ProfileTabDashboard() {
  const { t, i18n } = useTranslation();
  const { profile, session, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [showRatingExplainer, setShowRatingExplainer] = useState(false);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const playerProfileQuery = useQuery({
    queryKey: ["own-player-profile", session?.user.id],
    queryFn: () => getOwnPlayerProfile(supabase),
    enabled: Boolean(session),
  });
  const zonesQuery = useQuery({
    queryKey: ["own-zones", session?.user.id],
    queryFn: fetchOwnZones,
    enabled: Boolean(session),
  });
  const completedQuery = useQuery({
    queryKey: ["my-completed-matches"],
    queryFn: () => listMyCompletedMatches(supabase),
    enabled: Boolean(session),
  });

  const playerProfile = playerProfileQuery.data;
  const zones = zonesQuery.data ?? [];
  const matchesPlayed = completedQuery.data?.length ?? 0;

  const ratingValue = playerProfile
    ? profileScreenRatingStatValue(
        playerProfile.rated_match_count,
        playerProfile.internal_rating,
      )
    : "—";

  const ratingLabel = playerProfile
    ? isProvisionalPlayerRating(playerProfile.rated_match_count)
      ? (profileScreenRatingStatHint(playerProfile.rated_match_count, t) ??
        t("rating.ownRatingLabel"))
      : t("rating.ownRatingLabel")
    : t("rating.ownRatingLabel");

  async function refreshAvatarViews() {
    await Promise.all([
      refreshProfile(),
      queryClient.invalidateQueries({ queryKey: ["own-player-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["avatar-url"] }),
      queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
    ]);
  }

  const avatarMutation = useMutation({
    mutationFn: pickAndUploadOwnAvatar,
    onSuccess: async (result) => {
      if (result.status === "success") {
        await refreshAvatarViews();
        return;
      }

      if (result.status === "permission_denied") {
        notify(t("profile.avatarPermissionDenied"));
      }
    },
    onError: () => {
      notify(t("profile.avatarUploadError"));
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => clearOwnAvatar(supabase),
    onSuccess: refreshAvatarViews,
    onError: () => {
      notify(t("profile.avatarRemoveError"));
    },
  });

  // With a photo already set, going straight to the picker would leave no way
  // back to the initials placeholder.
  function handleAvatarPress() {
    if (!profile?.avatar_path) {
      avatarMutation.mutate();
      return;
    }

    // KNOWN GAP — silent on web. `Alert.alert` is a no-op under
    // react-native-web, so this sheet never opens there. It is the only dialog
    // left on `Alert` because it offers three outcomes (change / remove /
    // cancel) and every shared helper collapses to two: `chooseAction` would
    // either drop "remove" or make dismissing the sheet delete the photo.
    // Fixing it properly means giving the dialog a real third action rather
    // than degrading it here. Not in the cohort-1 rehearsal path.
    Alert.alert(t("profile.avatarEditLabel"), undefined, [
      {
        text: t("profile.avatarChange"),
        onPress: () => avatarMutation.mutate(),
      },
      {
        text: t("profile.avatarRemove"),
        style: "destructive",
        onPress: () => removeAvatarMutation.mutate(),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 80,
        }}
        showsVerticalScrollIndicator={false}
      >
        <OwnProfileHero
          name={profile?.display_name ?? t("profile.title")}
          avatarPath={profile?.avatar_path ?? null}
          locationLabel={zoneLabelFromList(zones, locale)}
          skillBand={playerProfile?.skill_band ?? "intermediate"}
          matchesPlayed={matchesPlayed}
          matchesPlayedLabel={profileScreenMatchesStatLabel(matchesPlayed, t)}
          ratingValue={ratingValue}
          ratingLabel={ratingLabel}
          editLabel={profileScreenEditLabel(t)}
          avatarEditLabel={t("profile.avatarEditLabel")}
          avatarUploading={
            avatarMutation.isPending || removeAvatarMutation.isPending
          }
          onAvatarPress={handleAvatarPress}
          onEdit={() => router.push("/profile/edit")}
          onRatingInfo={() => setShowRatingExplainer(true)}
        />

        <View style={styles.body}>
          <PlayerProfileSection title={profileScreenAboutTitle(t)}>
            {profile && playerProfile ? (
              <ProfileBioEditor
                displayName={profile.display_name ?? playerProfile.display_name}
                languages={profile.languages ?? []}
                bio={playerProfile.bio}
              />
            ) : null}
          </PlayerProfileSection>

          {playerProfile ? (
            <ProfileSkillBandSection playerProfile={playerProfile} />
          ) : null}

          <View style={styles.menuCard}>
            <ProfileMenuRow
              icon={
                <Icon name="place" size={20} color={tennisColors.primary} />
              }
              label={t("profile.whereIPlay.menu")}
              subtitle={t("profile.whereIPlay.menuHint")}
              onPress={() => router.push("/profile/where-i-play")}
            />
            <ProfileMenuRow
              icon={
                <Icon name="clock" size={20} color={tennisColors.primary} />
              }
              label={t("profile.availability")}
              subtitle={t("profile.availabilityHint")}
              onPress={() => router.push("/profile/availability")}
            />
            <ProfileMenuRow
              icon={
                <Icon
                  name="playIntent"
                  size={20}
                  color={tennisColors.primary}
                />
              }
              label={t("profile.matchDefaults.menu")}
              subtitle={t("profile.matchDefaults.menuHint")}
              onPress={() => router.push("/profile/match-defaults")}
            />
            <ProfileMenuRow
              icon={
                <Icon name="clubs" size={20} color={tennisColors.primary} />
              }
              label={t("home.liquidityClubs")}
              subtitle={t("home.liquidityClubsHint")}
              onPress={() => router.push(CLUBS_ROUTE)}
              showDivider={false}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.fabOverlay} pointerEvents="box-none">
        <ProfileSettingsFab onPress={() => router.push("/(tabs)/settings")} />
      </View>

      <Modal
        visible={showRatingExplainer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRatingExplainer(false)}
      >
        <Pressable
          accessibilityRole="button"
          style={styles.modalBackdrop}
          onPress={() => setShowRatingExplainer(false)}
        >
          <Pressable
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={styles.modalCard}
          >
            <AppText style={styles.modalTitle}>
              {t("profile.ratingExplainerTitle")}
            </AppText>
            <AppText style={styles.modalBody}>
              {t("profile.ratingExplainerBody")}
            </AppText>
            <FigmaPrimaryButton
              label={t("common.cancel")}
              onPress={() => setShowRatingExplainer(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  fabOverlay: {
    ...StyleSheet.absoluteFill,
  },
  screen: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  menuCard: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.xl,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    overflow: "hidden",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.xl,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 18,
    color: tennisColors.primaryDark,
  },
  modalBody: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    color: tennisColors.mutedForeground,
  },
});
