import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ErrorNotice,
  PrimaryButton,
  Screen,
} from "../../src/components/FormUi";
import { parseAuthUrl } from "../../src/lib/auth-url";
import { supabase } from "../../src/lib/supabase";

type CallbackState = "working" | "error";

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const liveUrl = Linking.useURL();
  const [state, setState] = useState<CallbackState>("working");

  useEffect(() => {
    let active = true;

    void (async () => {
      const url = liveUrl ?? (await Linking.getInitialURL());
      if (!url) {
        if (active) setState("error");
        return;
      }

      const payload = parseAuthUrl(url);
      const result =
        payload.kind === "code"
          ? await supabase.auth.exchangeCodeForSession(payload.code)
          : payload.kind === "session"
            ? await supabase.auth.setSession({
                access_token: payload.accessToken,
                refresh_token: payload.refreshToken,
              })
            : { error: new Error(payload.message) };

      if (!active) return;
      if (result.error) {
        setState("error");
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
      {state === "error" ? (
        <>
          <ErrorNotice>{t("auth.callbackError")}</ErrorNotice>
          <PrimaryButton
            label={t("auth.tryAgain")}
            onPress={() => router.replace("/(public)/sign-in")}
          />
        </>
      ) : null}
    </Screen>
  );
}
