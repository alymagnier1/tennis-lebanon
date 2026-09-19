import { useState } from "react";
import { confirmAction } from "../../src/lib/confirm-action";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { callerHasPassword, requestAccountDeletion } from "@tennis-lebanon/api";
import { PILOT_LOCALES, type PilotLocale } from "@tennis-lebanon/i18n";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import { Icon } from "../../src/components/Icon";
import {
  ChipButton,
  FigmaSubpageHero,
} from "../../src/components/onboarding-ui";
import { PlayerProfileSection } from "../../src/components/player/PlayerProfileSection";
import { ProfileMenuRow } from "../../src/components/profile/ProfileMenuRow";
import { env } from "../../src/lib/env";
import { applyLocale } from "../../src/lib/locale-sync";
import { goBackOrReplace, PROFILE_TAB_ROUTE } from "../../src/lib/navigation";
import {
  settingsScreenAccountTitle,
  settingsScreenAppearanceTitle,
  settingsScreenGeneralTitle,
  settingsScreenLanguageTitle,
  settingsScreenSupportTitle,
} from "../../src/lib/settings-screen-copy";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { useTennisTheme } from "../../src/providers/ThemeProvider";
import { useHeroVariant } from "../../src/providers/HeroVariantProvider";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { refreshProfile, signOut } = useAuth();
  const { preference, setPreference } = useTennisTheme();
  const { family, setFamily } = useHeroVariant();
  const { rowDirection } = useLayoutDirection();
  const [signOutError, setSignOutError] = useState(false);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

  /**
   * Offered only to accounts that cannot already be opened with a password,
   * which in practice means the ones Google created. Asking the server is the
   * only way to know: the session carries no hint, and it must not.
   */
  const passwordQuery = useQuery({
    queryKey: ["caller-has-password"],
    queryFn: () => callerHasPassword(supabase),
  });
  const deletion = useMutation({
    mutationFn: () => requestAccountDeletion(supabase),
    // Sign out rather than refreshing into the app. Staying signed in landed
    // the player on `account-unavailable` -- an account they had just asked to
    // delete, offering Contact support and Sign out -- which reads as the
    // request having failed. Signed out, `authRouteForState` sends them to
    // Welcome, which is the honest end of this flow.
    onSuccess: async () => {
      try {
        await signOut();
      } finally {
        await refreshProfile();
        router.replace("/");
      }
    },
  });

  const confirmDeletion = () => {
    confirmAction({
      title: t("settings.deleteTitle"),
      message: t("settings.deleteDescription"),
      confirmLabel: t("settings.requestDeletion"),
      cancelLabel: t("common.cancel"),
      onConfirm: () => deletion.mutate(),
    });
  };

  const logout = async () => {
    setSignOutError(false);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSignOutError(true);
    }
  };

  // Sign-in is a magic link, so signing out is not the cheap, reversible thing
  // it is on a password app -- getting back in means waiting on an email. That
  // earns the same confirmation the delete row above already gets.
  const confirmLogout = () => {
    confirmAction({
      title: t("auth.signOutConfirmTitle"),
      message: t("auth.signOutConfirmBody"),
      confirmLabel: t("auth.signOut"),
      cancelLabel: t("common.cancel"),
      onConfirm: () => void logout(),
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <FigmaSubpageHero
          title={t("settings.title")}
          description={t("settings.description")}
          onBack={() => goBackOrReplace(PROFILE_TAB_ROUTE)}
        />

        <View style={styles.body}>
          <PlayerProfileSection title={settingsScreenLanguageTitle(t)}>
            <View style={[styles.chips, { flexDirection: rowDirection }]}>
              {PILOT_LOCALES.map((locale: PilotLocale) => (
                <ChipButton
                  key={locale}
                  label={t(`languages.${locale}`)}
                  selected={i18n.resolvedLanguage === locale}
                  onPress={() => void applyLocale(locale)}
                />
              ))}
            </View>
          </PlayerProfileSection>

          <PlayerProfileSection title={settingsScreenAppearanceTitle(t)}>
            <View style={[styles.chips, { flexDirection: rowDirection }]}>
              <ChipButton
                label={t("settingsAppearanceSystem")}
                selected={preference === "system"}
                onPress={() => setPreference("system")}
              />
              <ChipButton
                label={t("settingsAppearanceLight")}
                selected={preference === "light"}
                onPress={() => setPreference("light")}
              />
              <ChipButton
                label={t("settingsAppearanceDark")}
                selected={preference === "dark"}
                onPress={() => setPreference("dark")}
              />
            </View>
          </PlayerProfileSection>

          {__DEV__ ? (
            <PlayerProfileSection title={t("settingsOnboardingHero")}>
              <AppText style={styles.heroHint}>
                {t("settingsOnboardingHeroHint")}
              </AppText>
              <View style={[styles.chips, { flexDirection: rowDirection }]}>
                <ChipButton
                  label={t("settingsOnboardingHeroGreen")}
                  selected={family === "green"}
                  onPress={() => setFamily("green")}
                />
                <ChipButton
                  label={t("settingsOnboardingHeroLight")}
                  selected={family === "light"}
                  onPress={() => setFamily("light")}
                />
              </View>
            </PlayerProfileSection>
          ) : null}

          <PlayerProfileSection
            title={settingsScreenGeneralTitle(t)}
            variant="grouped"
          >
            <ProfileMenuRow
              icon={
                <Icon
                  name="notifications"
                  size={16}
                  color={tennisColors.primary}
                />
              }
              label={t("notifications.settings.title")}
              onPress={() => router.push("/profile/notifications")}
              showDivider={false}
            />
            <ProfileMenuRow
              icon={
                <Icon name="matches" size={16} color={tennisColors.primary} />
              }
              label={t("notifications.centerTitle")}
              onPress={() => router.push("/notifications")}
            />
          </PlayerProfileSection>

          <PlayerProfileSection
            title={settingsScreenSupportTitle(t)}
            variant="grouped"
          >
            <ProfileMenuRow
              icon={<Icon name="info" size={16} color={tennisColors.primary} />}
              label={t("settings.policies")}
              onPress={() => router.push("/policies?document=privacy")}
            />
            <ProfileMenuRow
              icon={<Icon name="chat" size={16} color={tennisColors.primary} />}
              label={t("account.contactSupport")}
              onPress={() =>
                void Linking.openURL(`mailto:${env.SUPPORT_EMAIL}`)
              }
            />
            {__DEV__ ? (
              <ProfileMenuRow
                icon={
                  <Icon name="filter" size={16} color={tennisColors.primary} />
                }
                label={t("settings.rtlLayoutCheck")}
                onPress={() => router.push("/rtl-check")}
                showDivider={false}
              />
            ) : null}
          </PlayerProfileSection>

          <PlayerProfileSection
            title={settingsScreenAccountTitle(t)}
            variant="grouped"
          >
            {passwordQuery.data === false ? (
              <ProfileMenuRow
                icon={
                  <Icon name="lock" size={16} color={tennisColors.accent} />
                }
                label={t("auth.setPasswordRow")}
                subtitle={t("auth.setPasswordHint")}
                onPress={() =>
                  router.push({
                    pathname: "/(auth)/update-password",
                    params: { mode: "set" },
                  })
                }
              />
            ) : null}
            <ProfileMenuRow
              icon={<Icon name="close" size={16} color={tennisColors.accent} />}
              label={t("auth.signOut")}
              onPress={confirmLogout}
              showDivider={false}
              tone="danger"
            />
          </PlayerProfileSection>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("settings.requestDeletion")}
            disabled={deletion.isPending}
            onPress={confirmDeletion}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
              deletion.isPending && styles.deleteButtonDisabled,
            ]}
          >
            <AppText style={styles.deleteLabel}>
              {t("settings.requestDeletion")}
            </AppText>
          </Pressable>

          {signOutError ? (
            <ErrorNotice>{t("auth.signOutError")}</ErrorNotice>
          ) : null}
          {deletion.isError ? (
            <ErrorNotice>{t("settings.deleteError")}</ErrorNotice>
          ) : null}

          <AppText style={styles.version}>
            {t("settings.versionFooter", { version: appVersion })}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    scrollContent: {
      paddingBottom: 48,
    },
    body: {
      paddingHorizontal: 20,
      paddingTop: 20,
      gap: 16,
    },
    chips: {
      flexWrap: "wrap",
      gap: 8,
    },
    heroHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
      marginBottom: 10,
    },
    deleteButton: {
      alignItems: "center",
      paddingVertical: 8,
    },
    deleteButtonPressed: {
      opacity: 0.85,
    },
    deleteButtonDisabled: {
      opacity: 0.5,
    },
    deleteLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      color: tennisColors.danger,
      letterSpacing: -0.1,
    },
    version: {
      textAlign: "center",
      fontFamily: tennisFontFamily.body,
      fontSize: 11,
      color: tennisColors.mutedForeground,
      marginTop: 4,
    },
  }),
);
