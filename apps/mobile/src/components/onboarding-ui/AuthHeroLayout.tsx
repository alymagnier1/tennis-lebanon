import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { CourtGridOverlay } from "./CourtPattern";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";

export function AuthHeroLayout({
  children,
  footer,
}: PropsWithChildren<{ footer?: ReactNode }>) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <CourtGridOverlay />
      <View style={styles.decorCircleOuter} />
      <View style={styles.decorCircleInner} />
      <View style={styles.ball}>
        <View style={styles.ballStripe} />
      </View>

      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <AppText style={styles.logoMarkText}>✕</AppText>
        </View>
        <AppText style={styles.logoLabel}>Tennis Lebanon</AppText>
      </View>

      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export function AuthHeroHeadline({
  lines,
  highlightIndex,
}: {
  lines: string[];
  highlightIndex?: number;
}) {
  return (
    <View style={styles.headlineBlock}>
      {lines.map((line, index) => (
        <AppText
          key={line}
          style={[
            styles.headline,
            index === highlightIndex ? styles.headlineAccent : null,
          ]}
        >
          {line}
        </AppText>
      ))}
    </View>
  );
}

export function AuthHeroDescription({ children }: PropsWithChildren) {
  return <AppText style={styles.heroDescription}>{children}</AppText>;
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tennisColors.primary,
      paddingHorizontal: tennisSpacing.screenX,
      overflow: "hidden",
    },
    decorCircleOuter: {
      position: "absolute",
      width: 500,
      height: 500,
      borderRadius: 250,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      top: -120,
      right: -140,
    },
    decorCircleInner: {
      position: "absolute",
      width: 340,
      height: 340,
      borderRadius: 170,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.06)",
      top: -60,
      right: -80,
    },
    ball: {
      position: "absolute",
      top: 140,
      right: 32,
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: tennisColors.lime,
      borderWidth: 3,
      borderColor: tennisColors.heroBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    ballStripe: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2.5,
      borderColor: "rgba(255,255,255,0.5)",
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    logoMark: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: tennisColors.lime,
      alignItems: "center",
      justifyContent: "center",
    },
    logoMarkText: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 14,
      color: tennisColors.primary,
    },
    logoLabel: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 18,
      color: tennisColors.white,
      letterSpacing: -0.3,
    },
    body: {
      flex: 1,
      justifyContent: "flex-end",
      paddingBottom: 48,
    },
    footer: {
      gap: 12,
    },
    headlineBlock: {
      marginBottom: 20,
    },
    headline: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 44,
      lineHeight: 46,
      color: tennisColors.white,
      letterSpacing: -1.5,
    },
    headlineAccent: {
      color: tennisColors.lime,
    },
    heroDescription: {
      fontFamily: tennisFontFamily.body,
      fontSize: 16,
      lineHeight: 26,
      color: "rgba(255,255,255,0.65)",
      maxWidth: 280,
      marginBottom: 8,
    },
  }),
);
