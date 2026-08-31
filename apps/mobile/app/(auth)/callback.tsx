import { useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
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
import { parseAuthUrl } from "../../src/lib/auth-url";
import { supabase } from "../../src/lib/supabase";

type CallbackState =
  { kind: "working" } | { kind: "error"; reason: AuthCallbackFailure };

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
        setState({ kind: "error", reason: "generic" });
        return;
      }

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
            setState({ kind: "error", reason: "expired" });
          }
          return;
        }
        processedKeys.current.add(dedupeKey);
      }

      const result = await completeAuthFromUrl(supabase, url);
      if (!active) return;
      if (!result.ok) {
        setState({ kind: "error", reason: result.reason });
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
          <PrimaryButton
            label={t("auth.tryAgain")}
            onPress={() => router.replace("/(public)/sign-in")}
          />
        </>
      ) : null}
    </Screen>
  );
}
