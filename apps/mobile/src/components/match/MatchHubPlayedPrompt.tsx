import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { FigmaPrimaryButton, FigmaSecondaryButton } from "../onboarding-ui";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * "Did this match happen?" on the hub, for a match whose agreed hour passed
 * with no court recorded in the app (the group often books over WhatsApp).
 *
 * The server sends a reminder with the same question (`match_played_prompt`,
 * migration 048), but the hub never showed a way to answer it, so a joined
 * player who tapped the reminder landed on a match still saying "ready to
 * book" with nothing to press (founder, 2026-10-02). Yes moves the match on to
 * attendance and the score; No closes it.
 */
export function MatchHubPlayedPrompt({
  pending,
  onPlayed,
  onNotPlayed,
}: {
  /** Which answer is being saved, if any. */
  pending: "played" | "not_played" | null;
  onPlayed: () => void;
  onNotPlayed: () => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <View style={styles.iconWrap}>
          <Icon name="court" size={20} color={tennisColors.primary} />
        </View>
        <View style={styles.headerText}>
          <AppText
            accessibilityRole="header"
            style={[styles.title, { writingDirection }]}
          >
            {t("matches.hub.playedPrompt.title")}
          </AppText>
          <AppText style={[styles.body, { writingDirection }]}>
            {t("matches.hub.playedPrompt.body")}
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        <FigmaPrimaryButton
          label={t("matches.hub.playedPrompt.yes")}
          loading={pending === "played"}
          disabled={pending !== null}
          onPress={onPlayed}
        />
        <FigmaSecondaryButton
          label={t("matches.hub.playedPrompt.no")}
          loading={pending === "not_played"}
          disabled={pending !== null}
          onPress={onNotPlayed}
        />
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      gap: 14,
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
    actions: {
      gap: 10,
    },
  }),
);
