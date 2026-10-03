import { DevSettings, I18nManager, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";
import { nativeLayoutStartupAction } from "./native-layout-direction";

const RESTART_TRIED_KEY = "tennis-lebanon.native-ltr-restart-tried";

async function restartApp(): Promise<void> {
  if (Updates.isEnabled) {
    await Updates.reloadAsync();
    return;
  }
  if (__DEV__ && typeof DevSettings.reload === "function") {
    DevSettings.reload();
  }
}

/**
 * Keeps native layout left to right in every language; Arabic is mirrored by
 * the screens themselves (see `nativeLayoutStartupAction`). This replaces
 * switching native RTL with the language, which took effect at unpredictable
 * moments, doubled the screens' own mirroring, and was never undone when
 * switching back to English (founder, 2026-10-03).
 *
 * Also stops a phone set to Arabic from mirroring the app while it is in
 * English or French: React Native allows that by default.
 */
export async function keepNativeLayoutLeftToRight(): Promise<void> {
  if (Platform.OS === "web") return;

  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);

  try {
    const action = nativeLayoutStartupAction({
      nativeIsRtl: I18nManager.isRTL,
      restartAlreadyTried:
        (await SecureStore.getItemAsync(RESTART_TRIED_KEY)) === "1",
    });
    if (action === "none") {
      await SecureStore.deleteItemAsync(RESTART_TRIED_KEY);
    } else if (action === "restart") {
      await SecureStore.setItemAsync(RESTART_TRIED_KEY, "1");
      await restartApp();
    }
  } catch {
    // Without the restart this launch may stay mirrored; the next one is not.
  }
}
