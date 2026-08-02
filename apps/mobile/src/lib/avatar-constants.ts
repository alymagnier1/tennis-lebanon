export const AVATAR_SIGNED_URL_TTL_SECONDS = 3600;

/** Refresh signed URLs before Supabase expires them. */
export const AVATAR_URL_STALE_MS = (AVATAR_SIGNED_URL_TTL_SECONDS - 600) * 1000;
