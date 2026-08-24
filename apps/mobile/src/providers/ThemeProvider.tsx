import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Appearance, StatusBar, View, useColorScheme } from "react-native";
import {
  persistAppearancePreference,
  readAppearancePreference,
} from "../lib/appearance";
import {
  getActiveTennisTheme,
  setActiveTennisScheme,
  type AppearancePreference,
  type ResolvedAppearance,
  type TennisColorTokens,
  resolveAppearance,
} from "../theme/tennis-tokens";

type ThemeContextValue = {
  preference: AppearancePreference;
  scheme: ResolvedAppearance;
  colors: TennisColorTokens;
  setPreference: (next: AppearancePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] =
    useState<AppearancePreference>("system");

  const scheme = resolveAppearance(
    preference,
    systemScheme === "dark" ? "dark" : "light",
  );

  setActiveTennisScheme(scheme);

  useEffect(() => {
    let cancelled = false;
    void readAppearancePreference().then((stored) => {
      if (!cancelled) {
        setPreferenceState(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (preference === "system") {
      return;
    }
    try {
      Appearance.setColorScheme(preference);
    } catch {
      // Older runtimes and web ignore an explicit scheme.
    }
  }, [preference]);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    void persistAppearancePreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const active = getActiveTennisTheme();
    return {
      preference,
      scheme,
      colors: active.colors,
      setPreference,
    };
  }, [preference, scheme, setPreference]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={value.colors.background}
      />
      <View
        key={scheme}
        style={{ flex: 1, backgroundColor: value.colors.background }}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTennisTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    const active = getActiveTennisTheme();
    return {
      preference: "system",
      scheme: active.scheme,
      colors: active.colors,
      setPreference: () => undefined,
    };
  }
  return value;
}
