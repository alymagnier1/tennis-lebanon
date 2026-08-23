import {
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { getActiveTennisScheme } from "./tennis-tokens";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * StyleSheet.create snapshots colour strings. Wrap factories so a theme change
 * rebuilds the sheet from live `tennisColors` / semantic tokens.
 */
export function createLiveSheet<T extends NamedStyles<T>>(
  factory: () => T | NamedStyles<T>,
): T {
  let cachedScheme: string | null = null;
  let cached: T | null = null;

  const resolve = (): T => {
    const scheme = getActiveTennisScheme();
    if (cached && cachedScheme === scheme) {
      return cached;
    }
    cached = StyleSheet.create(factory()) as T;
    cachedScheme = scheme;
    return cached;
  };

  return new Proxy({} as T, {
    get(_target, prop) {
      return resolve()[prop as keyof T];
    },
    ownKeys() {
      return Reflect.ownKeys(resolve());
    },
    getOwnPropertyDescriptor(_target, prop) {
      const sheet = resolve();
      const desc = Reflect.getOwnPropertyDescriptor(sheet, prop);
      if (!desc) return undefined;
      return { ...desc, configurable: true };
    },
  });
}
