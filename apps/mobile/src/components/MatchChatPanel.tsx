import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMatchMessages, sendMatchMessage } from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { AppText } from "./AppText";
import { SectionTitle } from "./AppUi";
import { PrimaryButton, formStyles } from "./FormUi";
import { formatUtcInBeirut } from "../lib/beirut-time";
import { supabase } from "../lib/supabase";

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
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["match-messages", matchId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, matchId, queryClient]);

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
    <View style={formStyles.compactCard}>
      <SectionTitle title={t("matches.chat.title")} />
      {messagesQuery.isLoading ? (
        <ActivityIndicator accessibilityLabel={t("discover.loading")} />
      ) : null}
      <View style={styles.messages}>
        {messages.length === 0 ? (
          <AppText style={styles.empty}>{t("matches.chat.empty")}</AppText>
        ) : (
          messages.map((message) => (
            <View key={message.message_id} style={styles.messageRow}>
              <AppText style={styles.author} maxLines={1}>
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
        value={draft}
        onChangeText={setDraft}
        placeholder={t("matches.chat.placeholder")}
        style={styles.input}
        multiline
        maxLength={2000}
      />
      <PrimaryButton
        label={t("matches.chat.send")}
        disabled={!draft.trim()}
        loading={sendMutation.isPending}
        onPress={() => sendMutation.mutate(draft.trim())}
      />
      {sendMutation.isError ? (
        <AppText style={formStyles.errorText}>{t("matches.chat.error")}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  messages: {
    gap: spacing.sm,
    maxHeight: 240,
  },
  empty: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
  },
  messageRow: {
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  author: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  body: {
    color: colors.neutral[700],
    fontSize: typography.size.md,
  },
  time: {
    color: colors.neutral[500],
    fontSize: typography.size.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 44,
    color: colors.neutral[900],
  },
});
