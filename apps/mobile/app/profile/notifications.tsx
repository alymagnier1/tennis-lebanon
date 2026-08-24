import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import { SemanticBadge } from "../../src/components/SemanticBadge";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  FigmaSubpageHero,
  FigmaTextButton,
} from "../../src/components/onboarding-ui";
import { PlayerProfileSection } from "../../src/components/player/PlayerProfileSection";
import { goBackOrReplace, SETTINGS_TAB_ROUTE } from "../../src/lib/navigation";
import {
  getPushPermissionState,
  openSystemNotificationSettings,
  syncDevicePushToken,
  type PushPermissionState,
  type PushRegistrationResult,
} from "../../src/lib/push-notifications";
import {
  derivePushSettingsView,
  isEnableFailure,
  type PushSettingsTone,
} from "../../src/lib/push-settings";
import type { SemanticTone } from "../../src/theme/tennis-tokens";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

const TONE_BADGES: Record<PushSettingsTone, SemanticTone> = {
  on: "positive",
  off: "attention",
  blocked: "critical",
  unsupported: "neutral",
};

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const [permission, setPermission] = useState<PushPermissionState | null>(
    null,
  );
  const [registration, setRegistration] =
    useState<PushRegistrationResult | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [enableFailed, setEnableFailed] = useState(false);

  /**
   * Re-read on every focus, not just on mount: the recovery path for a blocked
   * user is to leave for the system settings app and come back, and nothing
   * else would tell us the answer changed.
   */
  const refresh = useCallback(async () => {
    const next = await getPushPermissionState();
    setPermission(next);

    // Silent — never prompts. Tells us whether a granted permission actually
    // produced a registered device, which is the difference between "on" and
    // "the OS allows it but this build cannot deliver".
    const result = await syncDevicePushToken().catch(
      (): PushRegistrationResult => "unavailable",
    );
    setRegistration(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const enable = async () => {
    setEnabling(true);
    setEnableFailed(false);
    try {
      const result = await syncDevicePushToken({ requestPermission: true });
      setRegistration(result);
      setEnableFailed(isEnableFailure(result));
    } catch {
      setEnableFailed(true);
    } finally {
      setEnabling(false);
      setPermission(await getPushPermissionState());
    }
  };

  const view = permission
    ? derivePushSettingsView({ permission, registration })
    : null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <FigmaSubpageHero
          title={t("notifications.settings.title")}
          description={t("notifications.settings.description")}
          onBack={() => goBackOrReplace(SETTINGS_TAB_ROUTE)}
        />

        <View style={styles.body}>
          <PlayerProfileSection title={t("notifications.settings.pushSection")}>
            {!view ? (
              <ActivityIndicator color={tennisColors.primary} />
            ) : (
              <>
                <View style={styles.statusRow}>
                  <SemanticBadge
                    label={t(view.statusKey)}
                    tone={TONE_BADGES[view.tone]}
                  />
                </View>
                <AppText style={styles.detail}>{t(view.detailKey)}</AppText>

                {view.action === "enable" ? (
                  <FigmaPrimaryButton
                    label={t("notifications.settings.enable")}
                    onPress={() => void enable()}
                    loading={enabling}
                  />
                ) : null}

                {view.action === "openSettings" ? (
                  <FigmaSecondaryButton
                    label={t("notifications.settings.openSystemSettings")}
                    onPress={() => void openSystemNotificationSettings()}
                  />
                ) : null}

                {enableFailed ? (
                  <ErrorNotice>
                    {t("notifications.settings.enableError")}
                  </ErrorNotice>
                ) : null}
              </>
            )}
          </PlayerProfileSection>

          <PlayerProfileSection title={t("notifications.centerTitle")}>
            <AppText style={styles.detail}>
              {t("notifications.settings.centerHint")}
            </AppText>
            <FigmaTextButton
              label={t("notifications.settings.openCenter")}
              onPress={() => router.push("/notifications")}
            />
          </PlayerProfileSection>
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
    statusRow: {
      alignSelf: "flex-start",
    },
    detail: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 19,
      color: tennisColors.mutedForeground,
    },
  }),
);
