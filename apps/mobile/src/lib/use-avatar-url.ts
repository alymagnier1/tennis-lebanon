import { useQuery } from "@tanstack/react-query";
import { AVATAR_URL_STALE_MS } from "./avatar-constants";
import { resolveAvatarUri } from "./avatar-url";

export function useAvatarUrl(avatarPath: string | null | undefined) {
  return useQuery({
    queryKey: ["avatar-url", avatarPath],
    queryFn: () => resolveAvatarUri(avatarPath),
    enabled: Boolean(avatarPath),
    staleTime: AVATAR_URL_STALE_MS,
    gcTime: AVATAR_URL_STALE_MS,
  });
}
