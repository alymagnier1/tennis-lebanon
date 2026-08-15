import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { listMatchMessages } from "@tennis-lebanon/api";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { matchChatPreviewLabel } from "../lib/match-chat-preview";
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
  onPress: () => void;
};

export function MatchChatEntry({
  matchId,
  enabled,
  locked = false,
  onPress,
}: MatchChatEntryProps) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  const messagesQuery = useQuery({
    queryKey: ["match-messages", matchId],
    queryFn: () => listMatchMessages(supabase, matchId),
    enabled,
  });

  if (!enabled && !locked) return null;

  const preview = locked
    ? t("matches.chat.lockedRecruiting")
    : matchChatPreviewLabel(messagesQuery.data ?? [], t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("matches.chat.open")}
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
