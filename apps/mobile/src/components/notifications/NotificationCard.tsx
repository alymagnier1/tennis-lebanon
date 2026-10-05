import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { useLayoutDirection } from "../../lib/layout-direction";
import type { NotificationLook } from "../../lib/notification-list";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * One row of the notification centre: an icon whose colour says what kind of
 * news it is, a short title and line, and the time. The day is the section
 * heading above, so the card shows the time only.
 */
export function NotificationCard({
  title,
  body,
  time,
  unread,
  look,
  onPress,
}: {
  title: string;
  body: string;
  time: string;
  unread: boolean;
  look: NotificationLook;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const tone = toneColors(look.tone, unread);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spokenLabel([
        unread ? t("notifications.unreadItem") : null,
        title,
        body,
        time,
      ])}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { flexDirection: rowDirection },
        unread && styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: tone.fill }]}>
        <Icon name={look.icon} size={20} color={tone.icon} />
      </View>

      <View style={styles.text}>
        <View style={[styles.titleRow, { flexDirection: rowDirection }]}>
          <AppText
            style={[
              styles.title,
              unread && styles.titleUnread,
              { writingDirection },
            ]}
            maxLines={2}
          >
            {title}
          </AppText>
          <View style={[styles.meta, { flexDirection: rowDirection }]}>
            <AppText style={styles.time}>{time}</AppText>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>
        {body ? (
          <AppText style={[styles.body, { writingDirection }]} maxLines={2}>
            {body}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Joins the parts as sentences without doubling their own punctuation. */
function spokenLabel(parts: (string | null)[]): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => (/[.!?؟]$/.test(part) ? part : `${part}.`))
    .join(" ");
}

/**
 * Lime for what waits on the reader, deep green for good news, quiet grey for
 * the rest. A quiet circle turns white on an unread card, whose tint would
 * otherwise swallow it. Read at render, so a theme switch takes effect.
 */
function toneColors(
  tone: NotificationLook["tone"],
  unread: boolean,
): { fill: string; icon: string } {
  const quietFill = unread ? tennisColors.card : tennisColors.muted;
  switch (tone) {
    case "action":
      return { fill: tennisColors.lime, icon: tennisColors.limeText };
    case "good":
      return { fill: tennisColors.primary, icon: tennisColors.onPrimary };
    case "setback":
      return { fill: quietFill, icon: tennisColors.mutedForeground };
    case "info":
      return { fill: quietFill, icon: tennisColors.primary };
  }
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: tennisRadii.xl,
      borderWidth: 1,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
    },
    cardUnread: {
      backgroundColor: tennisColors.secondary,
      borderColor: tennisColors.secondary,
    },
    cardPressed: {
      opacity: 0.9,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    text: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    titleRow: {
      alignItems: "flex-start",
      gap: 8,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 15,
      lineHeight: 20,
      color: tennisColors.primaryDark,
    },
    titleUnread: {
      fontFamily: tennisFontFamily.bodySemi,
    },
    meta: {
      alignItems: "center",
      gap: 6,
      paddingTop: 2,
    },
    time: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: tennisColors.primary,
    },
    body: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
  }),
);
