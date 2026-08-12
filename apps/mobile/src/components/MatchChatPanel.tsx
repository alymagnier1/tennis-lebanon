import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMatchMessages, sendMatchMessage } from "@tennis-lebanon/api";
import { AppText } from "./AppText";
import { formatUtcInBeirut } from "../lib/beirut-time";
import { useLayoutDirection } from "../lib/layout-direction";
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

type MatchChatPanelProps = {
  matchId: string;
  enabled: boolean;
  viewerUserId?: string;
};

export function MatchChatPanel({
  matchId,
  enabled,
  viewerUserId,
}: MatchChatPanelProps) {
  const { t } = useTranslation();
  const { writingDirection } = useLayoutDirection();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const messagesQuery = useQuery({
    queryKey: ["match-messages", matchId],
    queryFn: () => listMatchMessages(supabase, matchId),
    enabled,
  });

  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const statusRef = useRef<RealtimeStatus>("connecting");

  const refetchMessages = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["match-messages", matchId],
    });
  }, [matchId, queryClient]);

  // Synced in its own effect rather than during render, which React forbids for
  // refs. The ref exists so the subscription effect below does not tear the
  // channel down and rebuild it whenever this callback changes identity.
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

        const nextChannel = supabase
          .channel(matchChatChannelName(matchId))
          .on(
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
      await queryClient.invalidateQueries({
        queryKey: ["match-messages", matchId],
      });
    },
  });

  if (!enabled) return null;

  const messages = [...(messagesQuery.data ?? [])].reverse();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <AppText style={styles.title}>{t("matches.chat.title")}</AppText>

      {messagesQuery.isLoading ? (
        <ActivityIndicator
          color={tennisColors.primary}
          accessibilityLabel={t("common.loading")}
        />
      ) : null}

      {realtimeStatus === "interrupted" ? (
        <AppText style={styles.reconnecting} accessibilityRole="alert">
          {t("matches.chat.reconnecting")}
        </AppText>
      ) : null}

      <View style={styles.messages}>
        {messages.length === 0 ? (
          <AppText style={styles.empty}>{t("matches.chat.empty")}</AppText>
        ) : (
          messages.map((message) => {
            const isOwn = viewerUserId === message.author_id;
            return (
              <View
                key={message.message_id}
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
                      {message.author_display_name}
                    </AppText>
                  ) : null}
                  <AppText
                    style={[
                      styles.body,
                      { writingDirection },
                      isOwn ? styles.bodyOwn : styles.bodyOther,
                    ]}
                  >
                    {message.body}
                  </AppText>
                  <AppText
                    style={[
                      styles.time,
                      isOwn ? styles.timeOwn : styles.timeOther,
                    ]}
                  >
                    {formatUtcInBeirut(message.created_at)}
                  </AppText>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={t("matches.chat.placeholder")}
          value={draft}
          onChangeText={setDraft}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
    paddingBottom: 8,
  },
  title: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
  messages: {
    gap: 8,
    minHeight: 80,
  },
  empty: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  reconnecting: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
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
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
    paddingTop: 10,
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
});
