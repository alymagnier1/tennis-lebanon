import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { FigmaPrimaryButton, FigmaTextButton } from "../onboarding-ui";
import { trackEvent } from "../../lib/analytics";
import { useLayoutDirection } from "../../lib/layout-direction";
import { decidePushNudge, type PushNudgeDecision } from "../../lib/push-nudge";
import {
  hasSeenPushNudge,
  markPushNudgeSeen,
} from "../../lib/push-nudge-storage";
import {
  getPushPermissionState,
  openSystemNotificationSettings,
  syncDevicePushToken,
} from "../../lib/push-notifications";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * Asks for notifications at the first moment the benefit is concrete: the player
 * is looking at a match with a named opponent, so "we'll tell you when Rami
 * replies" is a promise about something that exists.
 *
 * Shown once per account per device, then never again — the settings screen owns
 * it after that.
 */
export function MatchPushNudge({
  userId,
  viewerIsParticipant,
}: {
  userId: string | undefined;
  viewerIsParticipant: boolean;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const [decision, setDecision] = useState<PushNudgeDecision>("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // No synchronous setState here: `decision` already starts hidden, and the
    // render guard below covers props changing back to invalid. Setting state in
    // an effect body triggers a cascading render.
    if (!userId || !viewerIsParticipant) {
      return;
    }

    let active = true;
    void (async () => {
      const [permission, alreadyAsked] = await Promise.all([
        getPushPermissionState(),
        hasSeenPushNudge(userId),
      ]);
      if (!active) return;

      setDecision(
        decidePushNudge({ permission, alreadyAsked, viewerIsParticipant }),
      );
    })();

    return () => {
      active = false;
    };
  }, [userId, viewerIsParticipant]);

  /** Dismissing counts as having been asked — one prompt means one prompt. */
  const close = useCallback(async () => {
    setDecision("hidden");
    if (userId) {
      await markPushNudgeSeen(userId).catch(() => undefined);
    }
  }, [userId]);

  if (decision === "hidden" || !userId || !viewerIsParticipant) {
    return null;
  }

  const enable = async () => {
    setBusy(true);
    try {
      const result = await syncDevicePushToken({ requestPermission: true });
      const permission = await getPushPermissionState();

      trackEvent("push_permission_prompted", {
        surface: "hub",
        granted: result === "registered",
        can_ask_again: permission.canAskAgain,
      });
    } finally {
      setBusy(false);
      await close();
    }
  };

  const openSettings = async () => {
    trackEvent("push_permission_prompted", {
      surface: "hub",
      granted: false,
      can_ask_again: false,
    });
    await openSystemNotificationSettings();
    await close();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <View style={styles.iconWrap}>
          <Icon name="notifications" size={20} color={tennisColors.primary} />
        </View>
        <View style={styles.headerText}>
          <AppText style={[styles.title, { writingDirection }]}>
            {t("notifications.nudge.title")}
          </AppText>
          <AppText style={[styles.body, { writingDirection }]}>
            {t(
              decision === "openSettings"
                ? "notifications.nudge.bodyBlocked"
                : "notifications.nudge.body",
            )}
          </AppText>
        </View>
      </View>

      <FigmaPrimaryButton
        label={t(
          decision === "openSettings"
            ? "notifications.nudge.openSettings"
            : "notifications.nudge.enable",
        )}
        loading={busy}
        onPress={() => {
          void (decision === "openSettings" ? openSettings() : enable());
        }}
      />
      <FigmaTextButton
        label={t("notifications.nudge.dismiss")}
        onPress={() => {
          void close();
        }}
      />
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      gap: 10,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
    },
    header: {
      alignItems: "flex-start",
      gap: 12,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: tennisRadii.md,
      backgroundColor: tennisColors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    title: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 16,
      color: tennisColors.primaryDark,
      letterSpacing: -0.2,
    },
    body: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 19,
      color: tennisColors.mutedForeground,
    },
  }),
);
