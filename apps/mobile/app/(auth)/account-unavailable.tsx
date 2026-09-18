import { useState } from "react";
import * as Linking from "expo-linking";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { cancelAccountDeletion } from "@tennis-lebanon/api";
import {
  ErrorNotice,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../src/components/FormUi";
import { env } from "../../src/lib/env";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { router } from "expo-router";

export default function AccountUnavailableScreen() {
  const { t } = useTranslation();
  const { state, signOut, refreshProfile } = useAuth();
  const [error, setError] = useState(false);
  const [restoreError, setRestoreError] = useState(false);

  // Only a pending deletion is the account holder's to undo. A suspension is a
  // moderation decision, and `cancel_account_deletion` refuses it anyway; not
  // offering the button is what stops a suspended player tapping a dead end.
  const isDeletionPending = state !== "suspended";

  const restore = useMutation({
    mutationFn: () => cancelAccountDeletion(supabase),
    onMutate: () => setRestoreError(false),
    onSuccess: async () => {
      await refreshProfile();
      router.replace("/");
    },
    onError: () => setRestoreError(true),
  });

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
      {restoreError ? (
        <ErrorNotice>{t("account.keepAccountError")}</ErrorNotice>
      ) : null}
      {isDeletionPending ? (
        <PrimaryButton
          label={t("account.keepAccount")}
          loading={restore.isPending}
          onPress={() => restore.mutate()}
        />
      ) : null}
      {isDeletionPending ? (
        <SecondaryButton
          label={t("account.contactSupport")}
          onPress={() => void Linking.openURL(`mailto:${env.SUPPORT_EMAIL}`)}
        />
      ) : (
        <PrimaryButton
          label={t("account.contactSupport")}
          onPress={() => void Linking.openURL(`mailto:${env.SUPPORT_EMAIL}`)}
        />
      )}
      <SecondaryButton
        label={t("auth.signOut")}
        onPress={() => void logout()}
      />
    </Screen>
  );
}
