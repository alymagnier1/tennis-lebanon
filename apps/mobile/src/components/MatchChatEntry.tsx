import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getOwnChatLastRead, listMatchMessages } from "@tennis-lebanon/api";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { matchChatPreviewLabel } from "../lib/match-chat-preview";
import {
  countUnreadMatchMessages,
  formatUnreadBadge,
} from "../lib/unread-match-messages";
import { useLayoutDirection } from "../lib/layout-direction";
import { supabase } from "../lib/supabase";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

type MatchChatEntryProps = {
  matchId: string;
  /** Load messages and allow navigation. */
  enabled: boolean;
  /** Show the row but block open (roster still filling). */
  locked?: boolean;
  /** Needed to tell somebody else's message from your own. */
  viewerUserId?: string;
  onPress: () => void;
};

export function MatchChatEntry({
  matchId,
  enabled,
  locked = false,
  viewerUserId,
  onPress,
}: MatchChatEntryProps) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  const messagesQuery = useQuery({
    queryKey: ["match-messages", matchId],
    queryFn: () => listMatchMessages(supabase, matchId),
    enabled,
  });

  const lastReadQuery = useQuery({
    queryKey: ["match-chat-last-read", matchId, viewerUserId],
    queryFn: () => getOwnChatLastRead(supabase, matchId),
    enabled: enabled && Boolean(viewerUserId),
  });

  if (!enabled && !locked) return null;

  // A locked thread cannot be opened, so a badge on it would only nag.
  const unread = locked
    ? 0
    : countUnreadMatchMessages({
        messages: messagesQuery.data ?? [],
        lastReadAt: lastReadQuery.data ?? null,
        viewerUserId,
      });
  const badge = formatUnreadBadge(unread);

  const preview = locked
    ? t("matches.chat.lockedRecruiting")
    : matchChatPreviewLabel(messagesQuery.data ?? [], t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        badge
          ? t("matches.chat.openWithUnread", { count: unread })
          : t("matches.chat.open")
      }
      accessibilityState={{ disabled: locked }}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        locked && styles.locked,
        pressed && !locked && styles.pressed,
      ]}
    >
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        <View style={[styles.iconWrap, locked && styles.iconWrapLocked]}>
          <Icon
            name="chat"
            size={20}
            color={locked ? tennisColors.mutedForeground : tennisColors.primary}
          />
        </View>
        <View style={styles.text}>
          <AppText style={[styles.title, { writingDirection }]} maxLines={1}>
            {t("matches.chat.title")}
          </AppText>
          <AppText style={[styles.preview, { writingDirection }]} maxLines={1}>
            {preview}
          </AppText>
        </View>
        {badge ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeLabel} maxLines={1}>
              {badge}
            </AppText>
          </View>
        ) : null}
        {!locked ? (
          <Icon name="chevron" size={18} color={tennisColors.mutedForeground} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: tennisColors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  locked: {
    opacity: 0.72,
  },
  pressed: {
    opacity: 0.92,
  },
  row: {
    alignItems: "center",
    gap: 12,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: tennisColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    color: tennisColors.white,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: tennisRadii.md,
    backgroundColor: tennisColors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapLocked: {
    backgroundColor: tennisColors.border,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
  preview: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
});
