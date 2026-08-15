import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { confirmExternalCourt } from "@tennis-lebanon/api";
import { notify } from "../lib/confirm-action";
import { supabase } from "../lib/supabase";
import { useToast } from "../providers/ToastProvider";

export type ConfirmExternalCourtInput = {
  courtId: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Shared by the hub's confirm sheet and the full booking screen.
 *
 * The RPC raises a handful of distinguishable failures -- a court taken in the
 * meantime, an hour in the past, a club block -- and each needs its own copy.
 * Keeping the mapping and the cache invalidation here means the fast path and
 * the fallback path cannot drift apart.
 */
export function useConfirmExternalCourt(
  matchId: string,
  options?: {
    onSuccess?: () => void;
    onError?: () => void;
    suppressToast?: boolean;
  },
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (input: ConfirmExternalCourtInput) =>
      confirmExternalCourt(supabase, { matchId, ...input }),
    onSuccess: () => {
      if (!options?.suppressToast) {
        showToast(t("matches.booking.externalSuccess"));
      }
      options?.onSuccess?.();
      void queryClient.invalidateQueries({ queryKey: ["match-hub", matchId] });
      void queryClient.invalidateQueries({ queryKey: ["my-matches"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      notify(
        message.includes("court_already_booked")
          ? t("matches.booking.courtAlreadyBooked")
          : message.includes("Invalid court time")
            ? t("matches.booking.courtTimeInPast")
            : message.includes("Court is blocked")
              ? t("matches.booking.courtBlocked")
              : t("matches.booking.externalError"),
      );
      options?.onError?.();
    },
  });
}
