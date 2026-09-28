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
import { ChatDoodles } from "./match/ChatDoodles";
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
import {
  composerBottomPadding,
  senderColorIndex,
  timestampSpacer,
} from "../lib/match-chat-layout";
import { useToast } from "../providers/ToastProvider";
import { supabase } from "../lib/supabase";
import { useKeyboardVisible } from "../hooks/useKeyboardVisible";
import { tennisChat, tennisColors } from "../theme/tennis-tokens";
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
  const { writingDirection, isRtl, rowDirection } = useLayoutDirection();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
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
        <View style={styles.dayRow}>
          <View style={styles.dayPill}>
            <AppText style={styles.empty}>{t("matches.chat.empty")}</AppText>
          </View>
        </View>
      }
      renderItem={({ item }) => {
        if (item.type === "day") {
          return (
            <View style={styles.dayRow}>
              <View style={styles.dayPill}>
                <AppText style={styles.dayLabel}>{item.label}</AppText>
              </View>
            </View>
          );
        }

        const { message, showSender, groupStart } = item;
        const isOwn = viewerUserId === message.author_id;
        // As in WhatsApp, the layout mirrors in Arabic: the viewer's own
        // messages sit on the right in English and French, on the left in
        // Arabic, and everyone else's opposite.
        const onRight = isOwn !== isRtl;
        const emojiOnly = isEmojiOnlyMessage(message.body);
        const tailed = groupStart && !emojiOnly;
        const time = formatUtcTimeInBeirut(message.created_at);
        const senderColor =
          tennisChat.senderNames[
            senderColorIndex(message.author_id, tennisChat.senderNames.length)
          ];

        return (
          <View
            style={[
              styles.bubbleRow,
              onRight ? styles.bubbleRowRight : styles.bubbleRowLeft,
              groupStart ? styles.bubbleGroupStart : null,
            ]}
          >
            <View
              // One stop for screen readers: sender, message and time together.
              accessible
              style={[
                styles.bubble,
                emojiOnly
                  ? styles.bubbleEmojiOnly
                  : isOwn
                    ? styles.bubbleOwn
                    : styles.bubbleOther,
                tailed
                  ? onRight
                    ? styles.bubbleTailRight
                    : styles.bubbleTailLeft
                  : null,
              ]}
            >
              {tailed ? (
                <View
                  style={[
                    styles.tail,
                    onRight ? styles.tailRight : styles.tailLeft,
                    {
                      borderTopColor: isOwn
                        ? tennisChat.ownBubble
                        : tennisChat.otherBubble,
                    },
                  ]}
                />
              ) : null}
              {!isOwn && showSender ? (
                <AppText
                  style={[
                    styles.sender,
                    { color: senderColor, writingDirection },
                  ]}
                  maxLines={1}
                >
                  {message.author_display_name}
                </AppText>
              ) : null}
              <AppText
                style={[
                  styles.body,
                  emojiOnly && styles.bodyEmojiOnly,
                  { writingDirection },
                ]}
              >
                {message.body}
                {emojiOnly ? null : (
                  <AppText style={styles.timeSpacer}>
                    {timestampSpacer(time)}
                  </AppText>
                )}
              </AppText>
              <AppText
                style={[
                  styles.time,
                  emojiOnly ? styles.timeEmojiOnly : styles.timeInBubble,
                  !emojiOnly && (isRtl ? styles.timeLeft : styles.timeRight),
                  { color: isOwn ? tennisChat.ownMeta : tennisChat.otherMeta },
                ]}
              >
                {time}
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
        !docked
          ? {
              paddingBottom: composerBottomPadding({
                bottomInset: insets.bottom,
                keyboardVisible,
              }),
            }
          : null,
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

      <View style={[styles.composer, { flexDirection: rowDirection }]}>
        <View style={[styles.field, { flexDirection: rowDirection }]}>
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
              pressed && styles.emojiTogglePressed,
            ]}
          >
            <Icon
              name={emojiOpen ? "close" : "emoji"}
              size={24}
              color={
                emojiOpen ? tennisColors.linkText : tennisColors.mutedForeground
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
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("matches.chat.send")}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => sendMutation.mutate(draft.trim())}
          style={({ pressed }) => [
            styles.sendButton,
            !canSend ? styles.sendDisabled : null,
            pressed && canSend ? styles.sendPressed : null,
          ]}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color={tennisColors.onPrimary} size="small" />
          ) : (
            // The arrow points the way the text runs, as in WhatsApp.
            <View style={isRtl ? styles.mirrored : null}>
              <Icon
                name="send"
                size={20}
                color={
                  canSend ? tennisColors.onPrimary : "rgba(255,255,255,0.5)"
                }
              />
            </View>
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
      <ChatDoodles />
      {reconnectBanner}
      {messageList}
      {composer}
    </KeyboardAvoider>
  );
}

/** A function, not a constant: the sheet is rebuilt per colour scheme. */
function bubbleShadow() {
  return {
    shadowColor: tennisChat.bubbleShadow,
    shadowOpacity: 0.13,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  } as const;
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tennisChat.wallpaper,
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
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 8,
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
      fontSize: 13,
      lineHeight: 18,
      color: tennisChat.dayPillText,
      textAlign: "center",
    },
    dayRow: {
      alignItems: "center",
      paddingVertical: 8,
    },
    dayPill: {
      ...bubbleShadow(),
      maxWidth: "85%",
      backgroundColor: tennisChat.dayPill,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    dayLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      lineHeight: 16,
      color: tennisChat.dayPillText,
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
      marginTop: 2,
    },
    bubbleGroupStart: {
      marginTop: 8,
    },
    bubbleRowRight: {
      alignItems: "flex-end",
    },
    bubbleRowLeft: {
      alignItems: "flex-start",
    },
    bubble: {
      ...bubbleShadow(),
      maxWidth: "80%",
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingTop: 6,
      paddingBottom: 8,
    },
    bubbleOwn: {
      backgroundColor: tennisChat.ownBubble,
    },
    bubbleOther: {
      backgroundColor: tennisChat.otherBubble,
    },
    // Big emoji stand on the wallpaper without a bubble, as in WhatsApp.
    bubbleEmojiOnly: {
      backgroundColor: "transparent",
      shadowOpacity: 0,
      elevation: 0,
      paddingHorizontal: 2,
    },
    // The first bubble in a run has a tail at its top corner.
    bubbleTailRight: {
      borderTopRightRadius: 0,
    },
    bubbleTailLeft: {
      borderTopLeftRadius: 0,
    },
    tail: {
      position: "absolute",
      top: 0,
      width: 0,
      height: 0,
      borderTopWidth: 10,
    },
    tailRight: {
      right: -7,
      borderRightWidth: 8,
      borderRightColor: "transparent",
    },
    tailLeft: {
      left: -7,
      borderLeftWidth: 8,
      borderLeftColor: "transparent",
    },
    sender: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 1,
    },
    body: {
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      lineHeight: 20,
      color: tennisChat.bubbleText,
    },
    bodyEmojiOnly: {
      fontSize: 40,
      lineHeight: 48,
    },
    timeSpacer: {
      fontSize: 15,
      lineHeight: 20,
    },
    time: {
      fontFamily: tennisFontFamily.body,
      fontSize: 11,
      lineHeight: 14,
    },
    timeInBubble: {
      position: "absolute",
      bottom: 5,
    },
    timeRight: {
      right: 8,
    },
    timeLeft: {
      left: 8,
    },
    timeEmojiOnly: {
      alignSelf: "flex-end",
      overflow: "hidden",
      marginTop: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: tennisChat.dayPill,
    },
    composerWrap: {
      paddingTop: 6,
      paddingHorizontal: 8,
    },
    composerDocked: {
      backgroundColor: tennisColors.card,
      paddingBottom: 10,
    },
    emojiTray: {
      paddingHorizontal: 4,
      paddingBottom: 6,
      gap: 4,
      alignItems: "center",
    },
    emojiChip: {
      minWidth: 44,
      minHeight: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiChipPressed: {
      backgroundColor: tennisChat.composerField,
    },
    emojiGlyph: {
      fontSize: 24,
      lineHeight: 30,
    },
    composer: {
      alignItems: "flex-end",
      gap: 6,
    },
    // WhatsApp's rounded message field, with the emoji button inside it.
    field: {
      ...bubbleShadow(),
      flex: 1,
      alignItems: "flex-end",
      minHeight: 48,
      borderRadius: 24,
      paddingHorizontal: 2,
      backgroundColor: tennisChat.composerField,
    },
    emojiToggle: {
      width: 44,
      height: 48,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiTogglePressed: {
      opacity: 0.6,
    },
    input: {
      flex: 1,
      minHeight: 48,
      maxHeight: 120,
      paddingTop: 13,
      paddingBottom: 13,
      paddingHorizontal: 4,
      fontFamily: tennisFontFamily.body,
      fontSize: 16,
      lineHeight: 22,
      color: tennisChat.bubbleText,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tennisColors.primary,
    },
    // Solid, not faded: a see-through button showed the wallpaper through it.
    // Only the arrow dims (`canSend`).
    sendDisabled: {},
    sendPressed: {
      opacity: 0.85,
    },
    mirrored: {
      transform: [{ scaleX: -1 }],
    },
  }),
);
