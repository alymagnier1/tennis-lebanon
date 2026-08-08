import { DevSettings, I18nManager, Platform } from "react-native";
import { getTextDirection, type SupportedLocale } from "@tennis-lebanon/i18n";

function reloadForLayoutDirection(): void {
  if (Platform.OS === "web") {
    return;
  }

  if (__DEV__ && typeof DevSettings.reload === "function") {
    DevSettings.reload();
  }
}

/**
 * Applies native RTL when the locale requires it. A reload is needed on
 * Android when the direction flips.
 */
export async function syncNativeLayoutDirection(
  locale: SupportedLocale,
): Promise<void> {
  const shouldRtl = getTextDirection(locale) === "rtl";
  if (I18nManager.isRTL === shouldRtl) {
    return;
  }

  I18nManager.allowRTL(shouldRtl);
  I18nManager.forceRTL(shouldRtl);
  reloadForLayoutDirection();
}
