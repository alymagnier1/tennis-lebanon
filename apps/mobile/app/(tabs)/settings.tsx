import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { requestAccountDeletion } from "@tennis-lebanon/api";
import { PILOT_LOCALES, type PilotLocale } from "@tennis-lebanon/i18n";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import { Icon } from "../../src/components/Icon";
import {
  ChipButton,
  OnboardingStepLayout,
} from "../../src/components/onboarding-ui";
import { PlayerProfileSection } from "../../src/components/player/PlayerProfileSection";
import { ProfileMenuRow } from "../../src/components/profile/ProfileMenuRow";
import { env } from "../../src/lib/env";
import { persistLocale } from "../../src/lib/i18n";
import { goBackOrReplace, PROFILE_TAB_ROUTE } from "../../src/lib/navigation";
import {
  settingsScreenAccountTitle,
  settingsScreenGeneralTitle,
  settingsScreenLanguageTitle,
  settingsScreenSupportTitle,
} from "../../src/lib/settings-screen-copy";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { refreshProfile, signOut } = useAuth();
  const { rowDirection } = useLayoutDirection();
  const [signOutError, setSignOutError] = useState(false);

  const deletion = useMutation({
    mutationFn: () => requestAccountDeletion(supabase),
    onSuccess: async () => {
      await refreshProfile();
      router.replace("/");
    },
  });

  const confirmDeletion = () => {
    Alert.alert(t("settings.deleteTitle"), t("settings.deleteDescription"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.requestDeletion"),
        style: "destructive",
        onPress: () => deletion.mutate(),
      },
    ]);
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

  return (
    <OnboardingStepLayout
      title={t("settings.title")}
      onBack={() => goBackOrReplace(PROFILE_TAB_ROUTE)}
      footer={
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
      }
    >
      <View style={styles.sections}>
        <PlayerProfileSection title={settingsScreenGeneralTitle(t)}>
          <View style={styles.rowsBleed}>
            <ProfileMenuRow
              icon={
                <Icon
                  name="notifications"
                  size={20}
                  color={tennisColors.primary}
                />
              }
              label={t("notifications.centerTitle")}
              onPress={() => router.push("/notifications")}
              showDivider={false}
            />
          </View>
        </PlayerProfileSection>

        <PlayerProfileSection title={settingsScreenLanguageTitle(t)}>
          <View style={[styles.chips, { flexDirection: rowDirection }]}>
            {PILOT_LOCALES.map((locale: PilotLocale) => (
              <ChipButton
                key={locale}
                label={t(`languages.${locale}`)}
                selected={i18n.resolvedLanguage === locale}
                onPress={() => void persistLocale(locale)}
              />
            ))}
          </View>
        </PlayerProfileSection>

        <PlayerProfileSection title={settingsScreenSupportTitle(t)}>
          <View style={styles.rowsBleed}>
            <ProfileMenuRow
              icon={<Icon name="info" size={20} color={tennisColors.primary} />}
              label={t("settings.policies")}
              onPress={() => router.push("/policies?document=privacy")}
            />
            <ProfileMenuRow
              icon={<Icon name="chat" size={20} color={tennisColors.primary} />}
              label={t("account.contactSupport")}
              onPress={() =>
                void Linking.openURL(`mailto:${env.SUPPORT_EMAIL}`)
              }
            />
            <ProfileMenuRow
              icon={
                <Icon name="filter" size={20} color={tennisColors.primary} />
              }
              label={t("settings.rtlLayoutCheck")}
              onPress={() => router.push("/rtl-check")}
              showDivider={false}
            />
          </View>
        </PlayerProfileSection>

        <PlayerProfileSection title={settingsScreenAccountTitle(t)}>
          <View style={styles.rowsBleed}>
            <ProfileMenuRow
              icon={
                <Icon name="close" size={20} color={tennisColors.primary} />
              }
              label={t("auth.signOut")}
              onPress={() => void logout()}
              showDivider={false}
            />
          </View>
        </PlayerProfileSection>
      </View>

      {signOutError ? (
        <ErrorNotice>{t("auth.signOutError")}</ErrorNotice>
      ) : null}
      {deletion.isError ? (
        <ErrorNotice>{t("settings.deleteError")}</ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: 16,
  },
  rowsBleed: {
    marginHorizontal: -16,
  },
  chips: {
    flexWrap: "wrap",
    gap: 8,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  deleteButtonPressed: {
    opacity: 0.85,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 15,
    color: tennisColors.danger,
  },
});
