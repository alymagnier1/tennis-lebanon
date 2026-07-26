import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { acceptMatchInvite } from "@tennis-lebanon/api";
import { PrimaryButton, Screen, formStyles } from "../../src/components/FormUi";
import { authRouteForState } from "../../src/lib/auth-routing";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t } = useTranslation();
  const { state } = useAuth();
  const attemptedRef = useRef(false);

  const acceptMutation = useMutation({
    mutationFn: () => acceptMatchInvite(supabase, token!),
    onSuccess: (matchId) => {
      router.replace({
        pathname: "/match/[id]",
        params: { id: matchId },
      });
    },
  });

  useEffect(() => {
    if (
      state === "ready" &&
      token &&
      !attemptedRef.current &&
      !acceptMutation.isPending &&
      !acceptMutation.isSuccess
    ) {
      attemptedRef.current = true;
      acceptMutation.mutate();
    }
  }, [acceptMutation, state, token]);

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state !== "ready") {
    const destination = authRouteForState(state);
    return (
      <Screen
        title={t("matches.invite.title")}
        description={t("matches.invite.signInRequired")}
      >
        {destination ? (
          <PrimaryButton
            label={t("auth.tryAgain")}
            onPress={() => router.replace(destination)}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen title={t("matches.invite.title")}>
      {acceptMutation.isPending ? (
        <ActivityIndicator accessibilityLabel={t("matches.invite.accepting")} />
      ) : null}
      {acceptMutation.isError ? (
        <View>
          <Text style={formStyles.errorText}>{t("matches.invite.acceptError")}</Text>
          <PrimaryButton
            label={t("common.retry")}
            onPress={() => acceptMutation.mutate()}
          />
        </View>
      ) : null}
    </Screen>
  );
}
