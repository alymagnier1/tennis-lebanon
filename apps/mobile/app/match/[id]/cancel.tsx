import { useState } from "react";
import { notify } from "../../../src/lib/confirm-action";

import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { cancelMatch } from "@tennis-lebanon/api";
import {
  cancelPolicyMessageKey,
  requiresCancelReason,
} from "@tennis-lebanon/domain";
import {
  FormField,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../../src/components/FormUi";
import { supabase } from "../../../src/lib/supabase";

export default function CancelMatchScreen() {
  const { id, status, bookingStartsAt } = useLocalSearchParams<{
    id: string;
    status?: string;
    bookingStartsAt?: string;
  }>();
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const matchStatus = status ?? "open";
  const reasonRequired = requiresCancelReason(matchStatus);

  const cancelMutation = useMutation({
    mutationFn: () => cancelMatch(supabase, id!, reason.trim() || undefined),
    onSuccess: () => {
      notify(t("matches.hub.cancelSuccess"));
      router.replace("/(tabs)/matches");
    },
    onError: () => notify(t("matches.hub.cancelError")),
  });

  return (
    <Screen
      title={t("matches.hub.cancel")}
      description={t(
        cancelPolicyMessageKey(
          matchStatus,
          bookingStartsAt ? decodeURIComponent(bookingStartsAt) : null,
        ),
        { hours: 24 },
      )}
    >
      {reasonRequired ? (
        <FormField
          label={t("matches.hub.cancelReasonLabel")}
          value={reason}
          onChangeText={setReason}
          placeholder={t("matches.hub.cancelReasonPlaceholder")}
          multiline
        />
      ) : null}

      <PrimaryButton
        label={t("matches.hub.cancel")}
        loading={cancelMutation.isPending}
        onPress={() => {
          if (reasonRequired && reason.trim().length < 3) {
            notify(t("matches.hub.cancelReasonRequired"));
            return;
          }
          cancelMutation.mutate();
        }}
      />
      <SecondaryButton
        label={t("common.cancel")}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
