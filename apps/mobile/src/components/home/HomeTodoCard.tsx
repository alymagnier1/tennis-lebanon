import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import type { HomeNextAction } from "../../lib/home-next-actions";
import {
  homeNextActionLabelKey,
  homeNextActionTone,
} from "../../lib/match-status-tone";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  tennisColors,
  tennisRadii,
  tennisSemantic,
} from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { ACTION_ICONS } from "./HomeNextActionCard";

/**
 * Everything waiting on the player, as one card: the most urgent item in
 * full, the rest as a count. A carousel hid items two and three behind a
 * swipe; three stacked rows made Home read as an inbox.
 */
export function HomeTodoCard({
  actions,
  factsFor,
  onPress,
  onMore,
}: {
  actions: HomeNextAction[];
  /** "Sat 12, 6:30 PM · JDK" for the row, or null to fall back to the body copy. */
  factsFor: (action: HomeNextAction) => string | null;
  onPress: (action: HomeNextAction) => void;
  onMore: () => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const first = actions[0];
  if (!first) return null;

  const rest = actions.slice(1);
  const palette = tennisSemantic[homeNextActionTone(first.kind)];
  const title = t(first.titleKey, first.params);
  const facts = factsFor(first) ?? t(first.bodyKey, first.params);
  const actionLabel = t(homeNextActionLabelKey(first.kind));

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${facts}`}
        accessibilityHint={actionLabel}
        onPress={() => onPress(first)}
        style={({ pressed }) => [
          styles.row,
          { flexDirection: rowDirection },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.iconTile, { backgroundColor: palette.fill }]}>
          <Icon
            name={ACTION_ICONS[first.kind]}
            size={18}
            color={palette.text}
          />
        </View>
        <View style={styles.copy}>
          <AppText style={[styles.title, { writingDirection }]} maxLines={1}>
            {title}
          </AppText>
          <AppText style={[styles.facts, { writingDirection }]} maxLines={1}>
            {facts}
          </AppText>
        </View>
        <View style={styles.cta}>
          <AppText style={styles.ctaLabel} maxLines={1}>
            {actionLabel}
          </AppText>
        </View>
      </Pressable>

      {rest.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.todo.moreA11y", { count: rest.length })}
          onPress={onMore}
          style={({ pressed }) => [
            styles.more,
            { flexDirection: rowDirection },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.mini, { flexDirection: rowDirection }]}>
            {rest.map((action, index) => {
              const tone = tennisSemantic[homeNextActionTone(action.kind)];
              return (
                <View
                  key={action.id}
                  style={[
                    styles.miniIcon,
                    { backgroundColor: tone.fill },
                    index > 0 && styles.miniOverlap,
                  ]}
                >
                  <Icon
                    name={ACTION_ICONS[action.kind]}
                    size={12}
                    color={tone.text}
                  />
                </View>
              );
            })}
          </View>
          <AppText
            style={[styles.moreLabel, { writingDirection }]}
            maxLines={1}
          >
            {t("home.todo.more", { count: rest.length })}
          </AppText>
          <Icon name="chevron" size={16} color={tennisColors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      overflow: "hidden",
    },
    row: {
      minHeight: 68,
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    pressed: {
      opacity: 0.85,
    },
    iconTile: {
      width: 36,
      height: 36,
      borderRadius: tennisRadii.sm,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 16,
      lineHeight: 21,
      color: tennisColors.primaryDark,
    },
    facts: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    cta: {
      flexShrink: 0,
      minHeight: 36,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      backgroundColor: tennisColors.lime,
    },
    ctaLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
      color: tennisColors.limeText,
    },
    more: {
      minHeight: minTouchTargetPx,
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      borderTopWidth: 1,
      borderTopColor: tennisColors.border,
    },
    mini: {
      alignItems: "center",
    },
    miniIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: tennisColors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    miniOverlap: {
      marginStart: -8,
    },
    moreLabel: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      color: tennisColors.primaryDark,
    },
  }),
);
