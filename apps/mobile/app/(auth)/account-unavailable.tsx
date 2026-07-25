import { useState } from "react";
import * as Linking from "expo-linking";
import { useTranslation } from "react-i18next";
import {
  ErrorNotice,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../src/components/FormUi";
import { env } from "../../src/lib/env";
import { useAuth } from "../../src/providers/AuthProvider";

export default function AccountUnavailableScreen() {
  const { t } = useTranslation();
  const { state, signOut } = useAuth();
  const [error, setError] = useState(false);

  const logout = async () => {
    setError(false);
    try {
      await signOut();
    } catch {
      setError(true);
    }
  };

  return (
    <Screen
      title={t("account.unavailableTitle")}
      description={
        state === "suspended"
          ? t("account.suspendedBody")
          : t("account.deletionPendingBody")
      }
    >
      {error ? <ErrorNotice>{t("auth.signOutError")}</ErrorNotice> : null}
      <PrimaryButton
        label={t("account.contactSupport")}
        onPress={() => void Linking.openURL(`mailto:${env.SUPPORT_EMAIL}`)}
      />
      <SecondaryButton
        label={t("auth.signOut")}
        onPress={() => void logout()}
      />
    </Screen>
  );
}
