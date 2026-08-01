import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMatchMessages, sendMatchMessage } from "@tennis-lebanon/api";
import { AppText } from "./AppText";
import { FigmaPrimaryButton } from "./onboarding-ui";
import { PlayerProfileSection } from "./player/PlayerProfileSection";
import { formatUtcInBeirut } from "../lib/beirut-time";
import {
  realtimeStatusFrom,
  shouldRefetchAfterStatusChange,
  type RealtimeStatus,
} from "../lib/realtime-status";
import { supabase } from "../lib/supabase";
import { tennisColors } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { onboardingInputStyle } from "./onboarding-ui/OnboardingStepLayout";

type MatchChatPanelProps = {
  matchId: string;
  enabled: boolean;
};

export function MatchChatPanel({ matchId, enabled }: MatchChatPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const messagesQuery = useQuery({
    queryKey: ["match-messages", matchId],
    queryFn: () => listMatchMessages(supabase, matchId),
    enabled,
  });

  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  // The refetch decision needs the value at callback time, not at render time.
  const statusRef = useRef<RealtimeStatus>("connecting");

  const refetchMessages = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["match-messages", matchId],
    });
  }, [matchId, queryClient]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`match-chat:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_messages",
          filter: `match_id=eq.${matchId}`,
        },
        refetchMessages,
      )
      .subscribe((event) => {
        const next = realtimeStatusFrom(event);
        const previous = statusRef.current;
        statusRef.current = next;
        setRealtimeStatus(next);

        if (shouldRefetchAfterStatusChange(previous, next)) {
          refetchMessages();
        }
      });

    // Backgrounding tears down the socket without always reporting a status,
    // so returning to the app refetches regardless of what the channel said.
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        refetchMessages();
      }
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);

    return () => {
      subscription.remove();
      void supabase.removeChannel(channel);
    };
  }, [enabled, matchId, refetchMessages]);

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
    <PlayerProfileSection title={t("matches.chat.title")}>
      {messagesQuery.isLoading ? (
        <ActivityIndicator
          color={tennisColors.primary}
          accessibilityLabel={t("discover.loading")}
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
          messages.map((message) => (
            <View key={message.message_id} style={styles.messageRow}>
              <AppText style={styles.sender} maxLines={1}>
                {message.author_display_name}
              </AppText>
              <AppText style={styles.body}>{message.body}</AppText>
              <AppText style={styles.time}>
                {formatUtcInBeirut(message.created_at)}
              </AppText>
            </View>
          ))
        )}
      </View>
      <TextInput
        accessibilityLabel={t("matches.chat.placeholder")}
        value={draft}
        onChangeText={setDraft}
        placeholder={t("matches.chat.placeholder")}
        style={onboardingInputStyle.input}
        multiline
      />
      <FigmaPrimaryButton
        label={t("matches.chat.send")}
        disabled={!draft.trim()}
        loading={sendMutation.isPending}
        onPress={() => sendMutation.mutate(draft.trim())}
      />
    </PlayerProfileSection>
  );
}

const styles = StyleSheet.create({
  messages: {
    gap: 12,
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
  messageRow: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  sender: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  body: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.primaryDark,
  },
  time: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    color: tennisColors.mutedForeground,
  },
});
