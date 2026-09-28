import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clearOwnAvatar } from "@tennis-lebanon/api";
import { notify } from "../lib/confirm-action";
import { pickAndUploadOwnAvatar } from "../lib/pick-own-avatar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

/**
 * Change or remove the player's own photo, and refresh every view that shows
 * it. Lives on Edit profile as two plain buttons; it used to be a three-way
 * `Alert` behind the Profile tab's avatar, which is a no-op on the web.
 */
export function useOwnAvatarActions() {
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  async function refreshAvatarViews() {
    await Promise.all([
      refreshProfile(),
      queryClient.invalidateQueries({ queryKey: ["own-player-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["avatar-url"] }),
      queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
    ]);
  }

  const changeMutation = useMutation({
    mutationFn: pickAndUploadOwnAvatar,
    onSuccess: async (result) => {
      if (result.status === "success") {
        await refreshAvatarViews();
        return;
      }
      if (result.status === "permission_denied") {
        notify(t("profile.avatarPermissionDenied"));
      }
    },
    onError: () => notify(t("profile.avatarUploadError")),
  });

  const removeMutation = useMutation({
    mutationFn: () => clearOwnAvatar(supabase),
    onSuccess: refreshAvatarViews,
    onError: () => notify(t("profile.avatarRemoveError")),
  });

  return {
    change: () => changeMutation.mutate(),
    remove: () => removeMutation.mutate(),
    busy: changeMutation.isPending || removeMutation.isPending,
  };
}
