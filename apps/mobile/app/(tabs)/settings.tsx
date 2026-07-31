import { useState } from "react";
import { Alert } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { requestAccountDeletion } from "@tennis-lebanon/api";
import { PILOT_LOCALES, type PilotLocale } from "@tennis-lebanon/i18n";
import {
  Choice,
  ErrorNotice,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../src/components/FormUi";
import { env } from "../../src/lib/env";
import { persistLocale } from "../../src/lib/i18n";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { refreshProfile, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState(false);

  const deletion = useMutation({
    mutationFn: () => requestAccountDeletion(supabase),
    onSuccess: async () => {
      await refreshProfile();
      router.replace("/");
    },
  });

  const confirmDeletion = () => {
    Alert.alert(t("settings.deleteTitle"), t("settings.deleteDescription"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.requestDeletion"),
        style: "destructive",
        onPress: () => deletion.mutate(),
      },
    ]);
  };

  const logout = async () => {
    setSignOutError(false);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSignOutError(true);
    }
  };

  return (
    <Screen title={t("settings.title")} description={t("settings.description")}>
      {PILOT_LOCALES.map((locale: PilotLocale) => (
        <Choice
          key={locale}
          label={t(`languages.${locale}`)}
          selected={i18n.resolvedLanguage === locale}
          onPress={() => void persistLocale(locale)}
        />
      ))}
      <SecondaryButton
        label={t("settings.policies")}
        onPress={() => router.push("/policies?document=privacy")}
      />
      <SecondaryButton
        label={t("settings.rtlLayoutCheck")}
        onPress={() => router.push("/rtl-check")}
      />
      <SecondaryButton
        label={t("account.contactSupport")}
        onPress={() => void Linking.openURL(`mailto:${env.SUPPORT_EMAIL}`)}
      />
      <SecondaryButton
        label={t("auth.signOut")}
        onPress={() => void logout()}
      />
      <PrimaryButton
        label={t("settings.requestDeletion")}
        onPress={confirmDeletion}
        loading={deletion.isPending}
      />
      {signOutError ? (
        <ErrorNotice>{t("auth.signOutError")}</ErrorNotice>
      ) : null}
      {deletion.isError ? (
        <ErrorNotice>{t("settings.deleteError")}</ErrorNotice>
      ) : null}
    </Screen>
  );
}
