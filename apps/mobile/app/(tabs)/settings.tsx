import { useCallback, useState } from "react";
import { confirmAction } from "../../src/lib/confirm-action";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { router, useFocusEffect } from "expo-router";
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
import { describeBuildInfo } from "../../src/lib/build-info";
import { env } from "../../src/lib/env";
import { applyLocale } from "../../src/lib/locale-sync";
import { goBackOrReplace, PROFILE_TAB_ROUTE } from "../../src/lib/navigation";
import {
  settingsScreenAccountTitle,
  settingsScreenAppearanceTitle,
  settingsScreenLanguageTitle,
  settingsScreenPreferencesTitle,
} from "../../src/lib/settings-screen-copy";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import {
  getPushPermissionState,
  syncDevicePushToken,
  type PushPermissionState,
  type PushRegistrationResult,
} from "../../src/lib/push-notifications";
import { derivePushSettingsView } from "../../src/lib/push-settings";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { useTennisTheme } from "../../src/providers/ThemeProvider";
import { useHeroVariant } from "../../src/providers/HeroVariantProvider";
import { tennisColors, tennisSpacing } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { refreshProfile, signOut } = useAuth();
  const { preference, setPreference } = useTennisTheme();
  const { family, setFamily } = useHeroVariant();
  const { rowDirection } = useLayoutDirection();
  const [signOutError, setSignOutError] = useState(false);
  const [supportError, setSupportError] = useState(false);
  const [pushPermission, setPushPermission] =
    useState<PushPermissionState | null>(null);
  const [pushRegistration, setPushRegistration] =
    useState<PushRegistrationResult | null>(null);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";
  const buildInfo = describeBuildInfo({
    isEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
    updateId: Updates.updateId,
  });

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

  const refreshPushStatus = useCallback(async () => {
    const next = await getPushPermissionState();
    setPushPermission(next);
    const result = await syncDevicePushToken().catch(
      (): PushRegistrationResult => "unavailable",
    );
    setPushRegistration(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPushStatus();
    }, [refreshPushStatus]),
  );

  const pushView = pushPermission
    ? derivePushSettingsView({
        permission: pushPermission,
        registration: pushRegistration,
      })
    : null;

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

  const openSupport = async () => {
    setSupportError(false);
    try {
      await Linking.openURL(`mailto:${env.SUPPORT_EMAIL}`);
    } catch {
      setSupportError(true);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <FigmaSubpageHero
          title={t("settings.title")}
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
            title={settingsScreenPreferencesTitle(t)}
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
              subtitle={pushView ? t(pushView.statusKey) : t("common.loading")}
              onPress={() => router.push("/profile/notifications")}
              showDivider={false}
            />
          </PlayerProfileSection>

          <PlayerProfileSection
            title={settingsScreenAccountTitle(t)}
            variant="grouped"
          >
            {passwordQuery.isPending ? (
              <ProfileMenuRow
                icon={
                  <ActivityIndicator size="small" color={tennisColors.accent} />
                }
                label={t("auth.setPasswordRow")}
                subtitle={t("common.loading")}
                onPress={() => undefined}
                disabled
                showChevron={false}
              />
            ) : null}
            {passwordQuery.isError ? (
              <ProfileMenuRow
                icon={
                  <Icon name="lock" size={16} color={tennisColors.accent} />
                }
                label={t("auth.setPasswordRow")}
                subtitle={
                  passwordQuery.isFetching
                    ? t("common.loading")
                    : t("settings.passwordCheckError")
                }
                onPress={() => void passwordQuery.refetch()}
                showChevron={false}
                disabled={passwordQuery.isFetching}
              />
            ) : null}
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
              icon={
                <Icon name="signOut" size={16} color={tennisColors.danger} />
              }
              label={t("auth.signOut")}
              onPress={confirmLogout}
              showChevron={false}
              tone="danger"
            />
            <ProfileMenuRow
              icon={
                <Icon name="warning" size={16} color={tennisColors.danger} />
              }
              label={t("settings.requestDeletion")}
              onPress={confirmDeletion}
              showDivider={false}
              showChevron={false}
              tone="danger"
              disabled={deletion.isPending}
            />
          </PlayerProfileSection>

          {signOutError ? (
            <ErrorNotice>{t("auth.signOutError")}</ErrorNotice>
          ) : null}
          {deletion.isError ? (
            <ErrorNotice>{t("settings.deleteError")}</ErrorNotice>
          ) : null}
          {supportError ? (
            <ErrorNotice>
              {t("settings.supportOpenError", { email: env.SUPPORT_EMAIL })}
            </ErrorNotice>
          ) : null}

          <View style={styles.footer}>
            <View style={[styles.footerLinks, { flexDirection: rowDirection }]}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("settings.policies")}
                onPress={() => router.push("/policies?document=privacy")}
                style={({ pressed }) => [
                  styles.footerLink,
                  pressed && styles.footerLinkPressed,
                ]}
              >
                <AppText style={styles.footerLinkLabel}>
                  {t("settings.policies")}
                </AppText>
              </Pressable>
              <AppText style={styles.footerDot}>·</AppText>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("account.contactSupport")}
                onPress={() => void openSupport()}
                style={({ pressed }) => [
                  styles.footerLink,
                  pressed && styles.footerLinkPressed,
                ]}
              >
                <AppText style={styles.footerLinkLabel}>
                  {t("account.contactSupport")}
                </AppText>
              </Pressable>
            </View>

            {__DEV__ ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.rtlLayoutCheck")}
                onPress={() => router.push("/rtl-check")}
                style={({ pressed }) => [
                  styles.footerLink,
                  pressed && styles.footerLinkPressed,
                ]}
              >
                <AppText style={styles.footerLinkLabel}>
                  {t("settings.rtlLayoutCheck")}
                </AppText>
              </Pressable>
            ) : null}

            <AppText style={styles.version}>
              {t("settings.versionFooter", { version: appVersion })}
            </AppText>
            {/* Selectable so a tester can copy it into a bug report, and
                compare the update ID with the EAS dashboard. */}
            <AppText selectable style={styles.version}>
              {buildInfo.source === "disabled"
                ? t("settings.buildInfoDisabled")
                : t("settings.buildInfo", {
                    runtime: buildInfo.runtime ?? "—",
                    channel: buildInfo.channel ?? "—",
                    source: t(`settings.buildSource.${buildInfo.source}`),
                  })}
            </AppText>
            {buildInfo.updateId ? (
              <AppText selectable style={styles.version}>
                {t("settings.buildInfoUpdate", { id: buildInfo.updateId })}
              </AppText>
            ) : null}
          </View>
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
      paddingBottom: tennisSpacing.screenBottom,
    },
    body: {
      paddingHorizontal: tennisSpacing.screenX,
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
    footer: {
      alignItems: "center",
      gap: 10,
      marginTop: 8,
    },
    footerLinks: {
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    footerLink: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    footerLinkPressed: {
      opacity: 0.75,
    },
    footerLinkLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.mutedForeground,
      letterSpacing: -0.1,
    },
    footerDot: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    version: {
      textAlign: "center",
      fontFamily: tennisFontFamily.body,
      fontSize: 11,
      color: tennisColors.mutedForeground,
    },
  }),
);
