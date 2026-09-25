import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { KeyboardAvoider } from "./KeyboardAvoider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMatchMessages,
  sendMatchMessage,
  markMatchChatRead,
} from "@tennis-lebanon/api";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { ErrorNotice } from "./FormUi";
import {
  beirutDateKey,
  formatShortUtcDateInBeirut,
  formatUtcTimeInBeirut,
} from "../lib/beirut-time";
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
import { invalidateMatchChatSurfaces } from "../lib/match-chat-queries";
import {
  buildMatchChatTranscript,
  matchChatDayLabel,
  type MatchChatTranscriptItem,
} from "../lib/match-chat-transcript";
import {
  realtimeStatusFrom,
  shouldRefetchAfterStatusChange,
  type RealtimeStatus,
} from "../lib/realtime-status";
import { useToast } from "../providers/ToastProvider";
import { supabase } from "../lib/supabase";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

const HUB_MESSAGE_LIST_HEIGHT = 220;

type MatchChatPanelProps = {
  matchId: string;
  enabled: boolean;
  viewerUserId?: string;
  /** Full-screen chat page vs sticky dock on the match hub. */
  variant?: "page" | "docked";
};

function previousBeirutDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0));
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return cursor.toISOString().slice(0, 10);
}

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
  const { showToast } = useToast();
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const listRef = useRef<FlatList<MatchChatTranscriptItem>>(null);
  const docked = variant === "docked";

  const messagesQuery = useQuery({
    queryKey: ["match-messages", matchId],
    queryFn: () => listMatchMessages(supabase, matchId),
    enabled,
  });

  const newestMessageAt = messagesQuery.data?.[0]?.created_at ?? null;
  const markedUpToRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !viewerUserId || newestMessageAt === null) return;
    if (markedUpToRef.current === newestMessageAt) return;

    markedUpToRef.current = newestMessageAt;
    void markMatchChatRead(supabase, matchId)
      .then((markedAt) => {
        if (markedAt) {
          queryClient.setQueryData(
            ["match-chat-last-read", matchId, viewerUserId],
            markedAt,
          );
        }
        invalidateMatchChatSurfaces(queryClient, matchId);
        void queryClient.invalidateQueries({
          queryKey: ["match-chat-last-read", matchId, viewerUserId],
        });
      })
      .catch(() => {
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
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
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

          if (next === "interrupted") {
            startPolling();
          }
          if (next === "connected") {
            stopPolling();
          }

          if (shouldRefetchAfterStatusChange(previous, next)) {
            refetch();
          }
        });
      } catch {
        if (!cancelled) {
          statusRef.current = "interrupted";
          setRealtimeStatus("interrupted");
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
      stopPolling();
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
    onError: () => {
      showToast(t("matches.chat.error"));
    },
  });

  function insertEmoji(emoji: string) {
    setDraft((current) => appendChatEmoji(current, emoji));
  }

  const chronological = useMemo(
    () => [...(messagesQuery.data ?? [])].reverse(),
    [messagesQuery.data],
  );

  const transcript = useMemo(() => {
    const todayKey = beirutDateKey(new Date().toISOString());
    const yesterdayKey = previousBeirutDateKey(todayKey);
    return buildMatchChatTranscript(chronological, (dateKey) =>
      matchChatDayLabel(dateKey, {
        todayKey,
        yesterdayKey,
        todayLabel: t("discover.today"),
        yesterdayLabel: t("matches.chat.yesterday"),
        formatDateKey: (key) =>
          formatShortUtcDateInBeirut(`${key}T12:00:00.000Z`),
      }),
    );
  }, [chronological, t]);

  if (!enabled) return null;

  const canSend = Boolean(draft.trim()) && !sendMutation.isPending;

  const messageList = messagesQuery.isLoading ? (
    <View style={[styles.loading, docked && styles.loadingDocked]}>
      <ActivityIndicator
        color={tennisColors.primary}
        accessibilityLabel={t("common.loading")}
      />
    </View>
  ) : messagesQuery.isError ? (
    <View style={[styles.errorBlock, docked && styles.loadingDocked]}>
      <ErrorNotice>{t("matches.chat.loadError")}</ErrorNotice>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.retry")}
        onPress={() => void messagesQuery.refetch()}
        style={styles.retryButton}
      >
        <AppText style={styles.retryLabel}>{t("common.retry")}</AppText>
      </Pressable>
    </View>
  ) : (
    <FlatList
      ref={listRef}
      data={transcript}
      keyExtractor={(item) => item.key}
      style={docked ? styles.listDocked : styles.list}
      contentContainerStyle={[
        docked ? styles.listContentDocked : styles.listContent,
        transcript.length === 0 ? styles.listContentEmpty : null,
      ]}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onContentSizeChange={() => {
        if (transcript.length > 0) {
          listRef.current?.scrollToEnd({ animated: false });
        }
      }}
      ListEmptyComponent={
        <AppText style={styles.empty}>{t("matches.chat.empty")}</AppText>
      }
      renderItem={({ item, index }) => {
        if (item.type === "day") {
          return (
            <View style={styles.dayRow}>
              <AppText style={styles.dayLabel}>{item.label}</AppText>
            </View>
          );
        }

        const { message, showSender, groupStart } = item;
        const isOwn = viewerUserId === message.author_id;
        const prev = transcript[index - 1];
        const tightTop =
          !groupStart && prev?.type === "message" ? styles.bubbleTight : null;

        return (
          <View
            style={[
              styles.bubbleRow,
              isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther,
              groupStart ? styles.bubbleGroupStart : null,
              tightTop,
            ]}
          >
            <View
              style={[
                styles.bubble,
                isOwn ? styles.bubbleOwn : styles.bubbleOther,
              ]}
            >
              {!isOwn && showSender ? (
                <AppText style={styles.sender} maxLines={1}>
                  {message.author_display_name}
                </AppText>
              ) : null}
              <AppText
                style={[
                  styles.body,
                  isEmojiOnlyMessage(message.body) && styles.bodyEmojiOnly,
                  { writingDirection },
                  isOwn ? styles.bodyOwn : styles.bodyOther,
                ]}
              >
                {message.body}
              </AppText>
              <AppText
                style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}
              >
                {formatUtcTimeInBeirut(message.created_at)}
              </AppText>
            </View>
          </View>
        );
      }}
    />
  );

  const reconnectBanner =
    realtimeStatus === "interrupted" ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("matches.chat.reconnecting")}
        onPress={refetchMessages}
        style={styles.reconnectingPress}
      >
        <AppText style={styles.reconnecting} accessibilityRole="alert">
          {t("matches.chat.reconnecting")}
        </AppText>
      </Pressable>
    ) : null;

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
          placeholderTextColor={tennisColors.mutedForeground}
          style={[styles.input, { writingDirection }]}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("matches.chat.send")}
          disabled={!canSend}
          onPress={() => sendMutation.mutate(draft.trim())}
          style={({ pressed }) => [
            styles.sendButton,
            canSend ? styles.sendReady : styles.sendDisabled,
            pressed && canSend ? styles.sendPressed : null,
          ]}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color={tennisColors.onPrimary} size="small" />
          ) : (
            <AppText
              style={[
                styles.sendLabel,
                !canSend ? styles.sendLabelDisabled : null,
              ]}
            >
              {t("matches.chat.send")}
            </AppText>
          )}
        </Pressable>
      </View>
    </View>
  );

  if (docked) {
    return (
      <View style={styles.dock}>
        <AppText style={styles.title}>{t("matches.chat.title")}</AppText>
        {reconnectBanner}
        {messageList}
        {composer}
      </View>
    );
  }

  return (
    <KeyboardAvoider style={styles.root}>
      {reconnectBanner}
      {messageList}
      {composer}
    </KeyboardAvoider>
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
    errorBlock: {
      flex: 1,
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 16,
    },
    retryButton: {
      alignSelf: "flex-start",
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    retryLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
      color: tennisColors.primary,
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
    listContentEmpty: {
      flexGrow: 1,
      justifyContent: "center",
    },
    empty: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
      textAlign: "center",
      paddingHorizontal: 12,
    },
    dayRow: {
      alignItems: "center",
      paddingVertical: 12,
    },
    dayLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      color: tennisColors.mutedForeground,
    },
    reconnectingPress: {
      minHeight: 36,
      justifyContent: "center",
    },
    reconnecting: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.mutedForeground,
      paddingHorizontal: 16,
      paddingVertical: 6,
      textDecorationLine: "underline",
    },
    bubbleRow: {
      width: "100%",
      marginBottom: 4,
    },
    bubbleGroupStart: {
      marginTop: 8,
    },
    bubbleTight: {
      marginTop: 0,
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
      fontSize: 11,
      lineHeight: 14,
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
      backgroundColor: tennisColors.card,
    },
    emojiToggleOpen: {
      backgroundColor: tennisColors.secondary,
    },
    emojiTogglePressed: {
      opacity: 0.88,
    },
    input: {
      flex: 1,
      maxHeight: 100,
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: tennisRadii.lg,
      backgroundColor: tennisColors.card,
      borderWidth: 1,
      borderColor: tennisColors.border,
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      lineHeight: 20,
      color: tennisColors.primaryDark,
    },
    sendButton: {
      minHeight: 44,
      minWidth: 64,
      borderRadius: tennisRadii.md,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    sendReady: {
      backgroundColor: tennisColors.primary,
    },
    sendDisabled: {
      backgroundColor: tennisColors.muted,
    },
    sendPressed: {
      opacity: 0.9,
    },
    sendLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      color: tennisColors.onPrimary,
    },
    sendLabelDisabled: {
      color: tennisColors.mutedForeground,
    },
  }),
);
