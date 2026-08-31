import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppText } from "../../src/components/AppText";
import {
  ErrorNotice,
  PrimaryButton,
  Screen,
} from "../../src/components/FormUi";
import {
  authCallbackDedupeKey,
  completeAuthFromUrl,
  waitForAuthCallbackUrl,
  type AuthCallbackFailure,
} from "../../src/lib/auth-callback";
import { describeAuthUrl, parseAuthUrl } from "../../src/lib/auth-url";
import { env } from "../../src/lib/env";
import { supabase } from "../../src/lib/supabase";

type CallbackState =
  | { kind: "working" }
  | { kind: "error"; reason: AuthCallbackFailure; shape: string };

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const liveUrl = Linking.useURL();
  const [state, setState] = useState<CallbackState>({ kind: "working" });
  const processedKeys = useRef(new Set<string>());

  useEffect(() => {
    let active = true;

    void (async () => {
      setState({ kind: "working" });
      const url = await waitForAuthCallbackUrl(liveUrl, () =>
        Linking.getInitialURL(),
      );
      if (!active) return;
      if (!url) {
        setState({
          kind: "error",
          reason: "generic",
          shape: describeAuthUrl(null),
        });
        return;
      }

      const shape = describeAuthUrl(url);
      const payload = parseAuthUrl(url);
      const dedupeKey = authCallbackDedupeKey(payload);
      if (dedupeKey) {
        if (processedKeys.current.has(dedupeKey)) {
          const { data } = await supabase.auth.getSession();
          if (!active) return;
          if (data.session) {
            router.replace("/");
          } else {
            // Same one-time link twice with nothing to show for it.
            setState({ kind: "error", reason: "expired", shape });
          }
          return;
        }
        processedKeys.current.add(dedupeKey);
      }

      const result = await completeAuthFromUrl(supabase, url);
      if (!active) return;
      if (!result.ok) {
        setState({ kind: "error", reason: result.reason, shape });
        return;
      }
      router.replace("/");
    })();

    return () => {
      active = false;
    };
  }, [liveUrl]);

  return (
    <Screen
      title={t("auth.callbackTitle")}
      description={t("auth.callbackWorking")}
    >
      {state.kind === "error" ? (
        <>
          <ErrorNotice>
            {state.reason === "expired"
              ? t("auth.callbackExpired")
              : t("auth.callbackError")}
          </ErrorNotice>
          {env.APP_ENV === "production" ? null : (
            <AppText style={styles.shape}>{state.shape}</AppText>
          )}
          <PrimaryButton
            label={t("auth.tryAgain")}
            onPress={() => router.replace("/(public)/sign-in")}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Redacted URL shape, shown outside production so a failed callback can be
  // diagnosed from the device instead of a 40-minute rebuild. Never a value.
  shape: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 8,
    marginBottom: 4,
  },
});
