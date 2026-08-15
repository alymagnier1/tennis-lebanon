import { setOwnNotificationLocale } from "@tennis-lebanon/api";
import { isSupportedLocale, type PilotLocale } from "@tennis-lebanon/i18n";
import { i18next, persistLocale } from "./i18n";
import { supabase } from "./supabase";

/**
 * Mirrors the chosen language onto the profile.
 *
 * The app's locale lives in device storage, which the Edge Function composing
 * push copy cannot read. Without this every push notification is English no
 * matter what the player picked in Settings.
 *
 * Best-effort by design: a failed write costs one notification's language, and
 * the next sync repairs it. Blocking a language change on the network would be
 * a worse trade.
 */
export async function pushLocaleToServer(locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) {
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return;
  }

  try {
    await setOwnNotificationLocale(supabase, locale);
  } catch {
    // Retried on the next sign-in or language change.
  }
}

/** Persists the language locally and tells the server, in that order. */
export async function applyLocale(locale: PilotLocale): Promise<void> {
  await persistLocale(locale);
  await pushLocaleToServer(locale);
}

/**
 * Brings an existing account in line without the player touching anything —
 * they chose their language before the server had anywhere to record it.
 */
export async function syncStoredLocaleToServer(): Promise<void> {
  await pushLocaleToServer(i18next.resolvedLanguage ?? i18next.language);
}
