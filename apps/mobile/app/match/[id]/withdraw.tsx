import { useState } from "react";
import { notify } from "../../../src/lib/confirm-action";

import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { withdrawFromBookedMatch } from "@tennis-lebanon/api";
import { leavePolicyMessageKey } from "@tennis-lebanon/domain";
import {
  FormField,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../../src/components/FormUi";
import { supabase } from "../../../src/lib/supabase";

export default function WithdrawMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawFromBookedMatch(supabase, id!, reason.trim()),
    onSuccess: () => {
      notify(t("matches.hub.withdrawSuccess"));
      router.replace("/(tabs)/matches");
    },
    onError: () => notify(t("matches.hub.withdrawError")),
  });

  return (
    <Screen
      title={t("matches.hub.withdraw")}
      description={t(leavePolicyMessageKey("confirmed", true), { hours: 24 })}
    >
      <FormField
        label={t("matches.hub.withdrawReasonLabel")}
        value={reason}
        onChangeText={setReason}
        placeholder={t("matches.hub.withdrawReasonPlaceholder")}
        multiline
      />

      <PrimaryButton
        label={t("matches.hub.withdraw")}
        loading={withdrawMutation.isPending}
        onPress={() => {
          if (reason.trim().length < 3) {
            notify(t("matches.hub.withdrawReasonRequired"));
            return;
          }
          withdrawMutation.mutate();
        }}
      />
      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}
