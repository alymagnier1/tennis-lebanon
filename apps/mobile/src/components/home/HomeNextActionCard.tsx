import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import type { HomeNextAction } from "../../lib/home-next-actions";
import {
  homeNextActionLabelKey,
  homeNextActionTone,
} from "../../lib/match-status-tone";
import { homeNextActionRoute } from "../../lib/routes";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  tennisColors,
  tennisSemantic,
  type SemanticTone,
  tennisRadii,
} from "../../theme/tennis-tokens";
import { AppText } from "../AppText";
import { Icon, type IconName } from "../Icon";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

const ACTION_ICONS: Record<HomeNextAction["kind"], IconName> = {
  invite: "notifications",
  vote: "matches",
  booking: "place",
  court: "place",
  played: "check",
  players: "discover",
  rematch: "court",
};

export function HomeNextActionCard({
  action,
  /**
   * Overrides the default navigation. Needed by `rematch`, which has to fetch the
   * hub and seed a create draft rather than simply route somewhere.
   */
  onPress,
}: {
  action: HomeNextAction;
  onPress?: (action: HomeNextAction) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const tone: SemanticTone = homeNextActionTone(action.kind);
  const palette = tennisSemantic[tone];
  const actionLabel = t(homeNextActionLabelKey(action.kind));

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.fill, borderColor: palette.border },
        { flexDirection: rowDirection },
      ]}
    >
      <View style={[styles.leading, { flexDirection: rowDirection }]}>
        <View style={[styles.iconWrap, { backgroundColor: palette.border }]}>
          <Icon
            name={ACTION_ICONS[action.kind]}
            size={16}
            color={palette.text}
          />
        </View>
        <View style={styles.textBlock}>
          <AppText
            style={[styles.title, { color: palette.text, writingDirection }]}
            maxLines={1}
          >
            {t(action.titleKey, action.params)}
          </AppText>
          <AppText
            style={[styles.body, { color: palette.text, writingDirection }]}
            maxLines={2}
          >
            {t(action.bodyKey, action.params)}
          </AppText>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={() => {
          if (onPress) {
            onPress(action);
            return;
          }
          router.push(homeNextActionRoute(action.kind, action.matchId));
        }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: tennisColors.violet },
          pressed && styles.buttonPressed,
        ]}
      >
        <AppText style={styles.buttonLabel} maxLines={1}>
          {actionLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      borderWidth: 1.5,
      borderRadius: tennisRadii.md,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: "center",
      gap: 10,
    },
    leading: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 10,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    textBlock: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
      lineHeight: 18,
    },
    body: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      opacity: 0.9,
    },
    button: {
      minHeight: minTouchTargetPx,
      minWidth: 72,
      paddingHorizontal: 14,
      borderRadius: tennisRadii.md,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      color: tennisColors.onViolet,
    },
  }),
);
