import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMatchMessages,
  sendMatchMessage,
  type MatchMessageRow,
  markMatchChatRead,
} from "@tennis-lebanon/api";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { formatUtcInBeirut } from "../lib/beirut-time";
import { useLayoutDirection } from "../lib/layout-direction";
import {
  MATCH_CHAT_EMOJIS,
  appendChatEmoji,
  isEmojiOnlyMessage,
} from "../lib/match-chat-emojis";
import {
  matchChatChannelName,
  MATCH_CHAT_POLL_MS,
  removeMatchChatChannels,
} from "../lib/match-chat-realtime";
import {
  realtimeStatusFrom,
  shouldRefetchAfterStatusChange,
  type RealtimeStatus,
} from "../lib/realtime-status";
import { supabase } from "../lib/supabase";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { onboardingInputStyle } from "./onboarding-ui/OnboardingStepLayout";

const HUB_MESSAGE_LIST_HEIGHT = 220;

type MatchChatPanelProps = {
  matchId: string;
  enabled: boolean;
  viewerUserId?: string;
  /** Full-screen chat page vs sticky dock on the match hub. */
  variant?: "page" | "docked";
};

export function MatchChatPanel({
  matchId,
  enabled,
  viewerUserId,
  variant = "page",
}: MatchChatPanelProps) {
  const { t } = useTranslation();
  const { writingDirection } = useLayoutDirection();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const listRef = useRef<FlatList<MatchMessageRow>>(null);
  const docked = variant === "docked";

  const messagesQuery = useQuery({
    queryKey: ["match-messages", matchId],
    queryFn: () => listMatchMessages(supabase, matchId),
    enabled,
  });

  // Reading the thread is what clears the badge. Keyed on the newest message
  // rather than firing per render, so a poll that returns nothing new does not
  // re-mark, while a message arriving while you are looking at it does.
  const newestMessageAt = messagesQuery.data?.[0]?.created_at ?? null;
  const markedUpToRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !viewerUserId || newestMessageAt === null) return;
    if (markedUpToRef.current === newestMessageAt) return;

    markedUpToRef.current = newestMessageAt;
    void markMatchChatRead(supabase, matchId)
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: ["match-chat-last-read", matchId, viewerUserId],
        }),
      )
      .catch(() => {
        // Let the next render try again rather than staying silently unread.
        markedUpToRef.current = null;
      });
  }, [enabled, viewerUserId, matchId, newestMessageAt, queryClient]);

  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const statusRef = useRef<RealtimeStatus>("connecting");

  const refetchMessages = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["match-messages", matchId],
    });
  }, [matchId, queryClient]);

  const refetchMessagesRef = useRef(refetchMessages);
  useEffect(() => {
    refetchMessagesRef.current = refetchMessages;
  }, [refetchMessages]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refetch = () => refetchMessagesRef.current();

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(refetch, MATCH_CHAT_POLL_MS);
      setRealtimeStatus("interrupted");
    };

    const connect = async () => {
      try {
        await removeMatchChatChannels(supabase, matchId);
        if (cancelled) return;

        const nextChannel = supabase.channel(matchChatChannelName(matchId)).on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "match_messages",
            filter: `match_id=eq.${matchId}`,
          },
          refetch,
        );

        if (cancelled) {
          await supabase.removeChannel(nextChannel);
          return;
        }

        channel = nextChannel;
        channel.subscribe((event) => {
          const next = realtimeStatusFrom(event);
          const previous = statusRef.current;
          statusRef.current = next;
          setRealtimeStatus(next);

          if (shouldRefetchAfterStatusChange(previous, next)) {
            refetch();
          }
        });
      } catch {
        if (!cancelled) {
          startPolling();
        }
      }
    };

    void connect();

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        refetch();
      }
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);

    return () => {
      cancelled = true;
      subscription.remove();
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      if (channel) {
        void supabase.removeChannel(channel);
      } else {
        void removeMatchChatChannels(supabase, matchId);
      }
    };
  }, [enabled, matchId]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMatchMessage(supabase, matchId, body),
    onSuccess: async () => {
      setDraft("");
      setEmojiOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["match-messages", matchId],
      });
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    },
  });

  function insertEmoji(emoji: string) {
    setDraft((current) => appendChatEmoji(current, emoji));
  }

  if (!enabled) return null;

  const messages = [...(messagesQuery.data ?? [])].reverse();

  const messageList = messagesQuery.isLoading ? (
    <View style={[styles.loading, docked && styles.loadingDocked]}>
      <ActivityIndicator
        color={tennisColors.primary}
        accessibilityLabel={t("common.loading")}
      />
    </View>
  ) : (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.message_id}
      style={docked ? styles.listDocked : styles.list}
      contentContainerStyle={[
        docked ? styles.listContentDocked : styles.listContent,
        messages.length === 0 ? styles.listContentEmpty : null,
      ]}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      onContentSizeChange={() => {
        if (messages.length > 0) {
          listRef.current?.scrollToEnd({ animated: false });
        }
      }}
      ListEmptyComponent={
        <AppText style={styles.empty}>{t("matches.chat.empty")}</AppText>
      }
      renderItem={({ item }) => {
        const isOwn = viewerUserId === item.author_id;
        return (
          <View
            style={[
              styles.bubbleRow,
              isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther,
            ]}
          >
            <View
              style={[
                styles.bubble,
                isOwn ? styles.bubbleOwn : styles.bubbleOther,
              ]}
            >
              {!isOwn ? (
                <AppText style={styles.sender} maxLines={1}>
                  {item.author_display_name}
                </AppText>
              ) : null}
              <AppText
                style={[
                  styles.body,
                  isEmojiOnlyMessage(item.body) && styles.bodyEmojiOnly,
                  { writingDirection },
                  isOwn ? styles.bodyOwn : styles.bodyOther,
                ]}
              >
                {item.body}
              </AppText>
              <AppText
                style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}
              >
                {formatUtcInBeirut(item.created_at)}
              </AppText>
            </View>
          </View>
        );
      }}
    />
  );

  const composer = (
    <View
      style={[
        styles.composerWrap,
        docked ? styles.composerDocked : null,
        !docked ? { paddingBottom: Math.max(insets.bottom, 10) } : null,
      ]}
    >
      {emojiOpen ? (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.emojiTray}
          accessibilityRole="toolbar"
        >
          {MATCH_CHAT_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={t("matches.chat.insertEmoji", { emoji })}
              onPress={() => insertEmoji(emoji)}
              style={({ pressed }) => [
                styles.emojiChip,
                pressed && styles.emojiChipPressed,
              ]}
            >
              <AppText style={styles.emojiGlyph}>{emoji}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            emojiOpen
              ? t("matches.chat.emojiPickerClose")
              : t("matches.chat.emojiPicker")
          }
          accessibilityState={{ expanded: emojiOpen }}
          onPress={() => setEmojiOpen((open) => !open)}
          style={({ pressed }) => [
            styles.emojiToggle,
            emojiOpen && styles.emojiToggleOpen,
            pressed && styles.emojiTogglePressed,
          ]}
        >
          <Icon
            name={emojiOpen ? "close" : "emoji"}
            size={22}
            color={
              emojiOpen ? tennisColors.primary : tennisColors.mutedForeground
            }
          />
        </Pressable>
        <TextInput
          accessibilityLabel={t("matches.chat.placeholder")}
          value={draft}
          onChangeText={setDraft}
          onFocus={() => setEmojiOpen(false)}
          placeholder={t("matches.chat.placeholder")}
          style={[onboardingInputStyle.input, styles.input]}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("matches.chat.send")}
          disabled={!draft.trim() || sendMutation.isPending}
          onPress={() => sendMutation.mutate(draft.trim())}
          style={({ pressed }) => [
            styles.sendButton,
            (!draft.trim() || sendMutation.isPending) && styles.sendDisabled,
            pressed && draft.trim() ? styles.sendPressed : null,
          ]}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color={tennisColors.white} size="small" />
          ) : (
            <AppText style={styles.sendLabel}>{t("matches.chat.send")}</AppText>
          )}
        </Pressable>
      </View>
    </View>
  );

  if (docked) {
    return (
      <View style={styles.dock}>
        <AppText style={styles.title}>{t("matches.chat.title")}</AppText>
        {realtimeStatus === "interrupted" ? (
          <AppText style={styles.reconnecting} accessibilityRole="alert">
            {t("matches.chat.reconnecting")}
          </AppText>
        ) : null}
        {messageList}
        {composer}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      {realtimeStatus === "interrupted" ? (
        <AppText style={styles.reconnecting} accessibilityRole="alert">
          {t("matches.chat.reconnecting")}
        </AppText>
      ) : null}
      {messageList}
      {composer}
    </KeyboardAvoidingView>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    dock: {
      backgroundColor: tennisColors.card,
      borderTopWidth: 1,
      borderTopColor: tennisColors.border,
      paddingTop: 12,
    },
    title: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 15,
      color: tennisColors.primaryDark,
      letterSpacing: -0.2,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingDocked: {
      height: HUB_MESSAGE_LIST_HEIGHT,
      flex: 0,
    },
    list: {
      flex: 1,
    },
    listDocked: {
      height: HUB_MESSAGE_LIST_HEIGHT,
      flexGrow: 0,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    listContentDocked: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
      flexGrow: 1,
    },
    separator: {
      height: 8,
    },
    listContentEmpty: {
      flexGrow: 1,
      justifyContent: "center",
    },
    empty: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.mutedForeground,
      textAlign: "center",
    },
    reconnecting: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.mutedForeground,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    bubbleRow: {
      width: "100%",
    },
    bubbleRowOwn: {
      alignItems: "flex-end",
    },
    bubbleRowOther: {
      alignItems: "flex-start",
    },
    bubble: {
      maxWidth: "85%",
      borderRadius: tennisRadii.lg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 4,
    },
    bubbleOwn: {
      backgroundColor: tennisColors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      backgroundColor: tennisColors.muted,
      borderBottomLeftRadius: 4,
    },
    sender: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 11,
      color: tennisColors.mutedForeground,
    },
    body: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
    },
    bodyEmojiOnly: {
      fontSize: 28,
      lineHeight: 34,
    },
    bodyOwn: {
      color: tennisColors.white,
    },
    bodyOther: {
      color: tennisColors.primaryDark,
    },
    time: {
      fontFamily: tennisFontFamily.body,
      fontSize: 10,
      alignSelf: "flex-end",
    },
    timeOwn: {
      color: tennisColors.white,
      opacity: 0.85,
    },
    timeOther: {
      color: tennisColors.mutedForeground,
    },
    composerWrap: {
      borderTopWidth: 1,
      borderTopColor: tennisColors.border,
      backgroundColor: tennisColors.background,
      paddingTop: 8,
    },
    composerDocked: {
      backgroundColor: tennisColors.card,
      paddingBottom: 10,
    },
    emojiTray: {
      paddingHorizontal: 12,
      paddingBottom: 8,
      gap: 4,
      alignItems: "center",
    },
    emojiChip: {
      minWidth: 40,
      minHeight: 40,
      borderRadius: tennisRadii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiChipPressed: {
      backgroundColor: tennisColors.muted,
    },
    emojiGlyph: {
      fontSize: 24,
      lineHeight: 30,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 16,
    },
    emojiToggle: {
      width: 44,
      height: 44,
      borderRadius: tennisRadii.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
    },
    emojiToggleOpen: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisColors.secondary,
    },
    emojiTogglePressed: {
      opacity: 0.88,
    },
    input: {
      flex: 1,
      maxHeight: 100,
    },
    sendButton: {
      minHeight: 44,
      minWidth: 64,
      borderRadius: tennisRadii.md,
      backgroundColor: tennisColors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    sendDisabled: {
      opacity: 0.5,
    },
    sendPressed: {
      opacity: 0.9,
    },
    sendLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      color: tennisColors.white,
    },
  }),
);
