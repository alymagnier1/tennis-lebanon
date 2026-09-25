import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import { createLiveSheet } from "../theme/create-live-sheet";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { useLayoutDirection } from "../lib/layout-direction";
import { tennisColors, tennisSemantic } from "../theme/tennis-tokens";

/**
 * One app-level bar instead of an offline branch on fifty screens.
 *
 * Losing signal used to be indistinguishable from a server error: the query
 * failed and every screen said "couldn't load". The `onlineManager` bridge in
 * `app/_layout.tsx` now pauses queries instead of failing them, which means a
 * screen can sit silently on stale data with no explanation — so the state has
 * to be said out loud somewhere, once.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();
  const [online, setOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setOnline), []);

  if (online) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.bar, { paddingTop: insets.top + 8 }]}
    >
      <AppText style={[styles.title, { writingDirection }]}>
        {t("common.offline.title")}
      </AppText>
      <AppText style={[styles.body, { writingDirection }]}>
        {t("common.offline.body")}
      </AppText>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    bar: {
      paddingHorizontal: 20,
      paddingBottom: 10,
      gap: 2,
      backgroundColor: tennisSemantic.attention.fill,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tennisColors.border,
    },
    title: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      lineHeight: 18,
      color: tennisSemantic.attention.text,
    },
    body: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisSemantic.attention.text,
    },
  }),
);
