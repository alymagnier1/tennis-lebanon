import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { homeNextActionRoute } from "../../lib/routes";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { AppText } from "../AppText";
import { Icon } from "../Icon";

const COPY = {
  availability: {
    icon: "clock",
    titleKey: "home.nextAction.availabilityTitle",
    bodyKey: "home.nudge.availabilityBody",
    actionKey: "home.nudge.add",
  },
  favoriteClubs: {
    icon: "clubs",
    titleKey: "home.nextAction.favoriteClubsTitle",
    bodyKey: "home.nextAction.favoriteClubsBody",
    actionKey: "home.nudge.choose",
  },
} as const;

/**
 * One quiet setup reminder, placed next to what it improves rather than in
 * the to-do card: hours under Who's free, clubs under Open matches.
 */
export function HomeSetupNudge({
  kind,
}: {
  kind: "availability" | "favoriteClubs";
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const copy = COPY[kind];
  const title = t(copy.titleKey);
  const body = t(copy.bodyKey);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityHint={t(copy.actionKey)}
      onPress={() => router.push(homeNextActionRoute(kind))}
      style={({ pressed }) => [
        styles.nudge,
        { flexDirection: rowDirection },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        <Icon name={copy.icon} size={18} color={tennisColors.violetText} />
      </View>
      <View style={styles.copy}>
        <AppText style={[styles.title, { writingDirection }]} maxLines={1}>
          {title}
        </AppText>
        <AppText style={[styles.body, { writingDirection }]} maxLines={2}>
          {body}
        </AppText>
      </View>
      <AppText style={styles.action} maxLines={1}>
        {t(copy.actionKey)}
      </AppText>
    </Pressable>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    nudge: {
      minHeight: minTouchTargetPx,
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: tennisColors.border,
    },
    pressed: {
      opacity: 0.8,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tennisColors.muted,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    title: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 15,
      color: tennisColors.primaryDark,
    },
    body: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    action: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 15,
      color: tennisColors.violetText,
    },
  }),
);
