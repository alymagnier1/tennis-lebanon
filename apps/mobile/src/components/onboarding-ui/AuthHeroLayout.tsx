import type { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { HeroScrim } from "./HeroScrim";
import { useHeroVariant } from "../../providers/HeroVariantProvider";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import {
  tennisColors,
  tennisHeroArt,
  tennisSpacing,
} from "../../theme/tennis-tokens";
import { createLiveSheet } from "../../theme/create-live-sheet";
import type { HeroFamily } from "../../theme/hero-variant";

const ART = {
  court: require("../../../assets/onboarding/mid-lines-court.png"),
  cut: require("../../../assets/onboarding/mid-lines-cut.png"),
  markLime: require("../../../assets/onboarding/rb-icon-lime.png"),
  markDark: require("../../../assets/onboarding/rb-icon-dark.png"),
} as const;

type HeroField = {
  ground: string;
  art: number;
  artShadow: boolean;
  statusBar: "light" | "dark";
  topScrim?: {
    height: number;
    colors: [string, string, ...string[]];
    locations: [number, number, ...number[]];
  };
  bottomScrim: {
    height: number;
    colors: [string, string, ...string[]];
    locations: [number, number, ...number[]];
  };
  mark: number;
  wordmark: string;
  ink: string;
  accent: string;
  description: string;
  display: "plate" | "display";
  headlineMarginTop: number;
};

function heroFields(): Record<HeroFamily, HeroField> {
  return {
    green: {
      ground: tennisHeroArt.heroPlate,
      art: ART.court,
      artShadow: false,
      statusBar: "light",
      topScrim: {
        height: 300,
        colors: [
          "rgba(10,45,38,0.72)",
          "rgba(10,45,38,0.18)",
          "rgba(10,45,38,0)",
        ],
        locations: [0, 0.68, 1],
      },
      bottomScrim: {
        height: 330,
        colors: [
          "rgba(18,54,40,0)",
          "rgba(18,54,40,0.82)",
          "rgba(16,48,36,0.94)",
          "rgba(14,44,33,0.97)",
        ],
        locations: [0, 0.26, 0.58, 1],
      },
      mark: ART.markLime,
      wordmark: tennisColors.white,
      ink: tennisColors.white,
      accent: tennisColors.lime,
      description: tennisColors.white,
      display: "plate",
      headlineMarginTop: 36,
    },
    light: {
      ground: tennisHeroArt.heroClay,
      art: ART.cut,
      artShadow: true,
      statusBar: "dark",
      bottomScrim: {
        height: 216,
        colors: [
          "rgba(232,220,194,0)",
          "rgba(232,220,194,0.9)",
          tennisHeroArt.heroClay,
        ],
        locations: [0, 0.44, 1],
      },
      mark: ART.markDark,
      wordmark: tennisHeroArt.heroOnLight,
      ink: tennisHeroArt.heroOnLight,
      accent: tennisHeroArt.heroGreen,
      description: "rgba(13,28,20,0.68)",
      display: "display",
      headlineMarginTop: 36,
    },
  };
}

export function AuthHeroLayout({
  headline,
  description,
  footer,
}: {
  headline: ReactNode;
  description: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { family } = useHeroVariant();
  const field = heroFields()[family];

  return (
    <View style={[styles.root, { backgroundColor: field.ground }]}>
      <StatusBar style={field.statusBar} />
      <Image
        source={field.art}
        resizeMode="cover"
        style={[styles.art, field.artShadow ? styles.artShadow : null]}
        accessibilityIgnoresInvertColors
      />
      {field.topScrim ? (
        <HeroScrim
          anchor="top"
          height={field.topScrim.height}
          colors={field.topScrim.colors}
          locations={field.topScrim.locations}
        />
      ) : null}
      <HeroScrim
        anchor="bottom"
        height={field.bottomScrim.height}
        colors={field.bottomScrim.colors}
        locations={field.bottomScrim.locations}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 36,
            paddingBottom: insets.bottom + 34,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <Image
            source={field.mark}
            style={styles.mark}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <AppText
            style={[tennisTextStyles.wordmark, { color: field.wordmark }]}
          >
            {t("common.appName")}
          </AppText>
        </View>
        <View style={{ marginTop: field.headlineMarginTop }}>{headline}</View>
        <View style={styles.spacer} />
        {description}
        {footer}
      </ScrollView>
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
  const { family } = useHeroVariant();
  const field = heroFields()[family];
  const type =
    field.display === "plate"
      ? tennisTextStyles.heroDisplayPlate
      : tennisTextStyles.heroDisplay;

  return (
    <View>
      {lines.map((line, index) => (
        <AppText
          key={`${index}-${line}`}
          style={[
            type,
            { color: index === highlightIndex ? field.accent : field.ink },
          ]}
        >
          {line}
        </AppText>
      ))}
    </View>
  );
}

export function AuthHeroDescription({ children }: { children: ReactNode }) {
  const { family } = useHeroVariant();
  const field = heroFields()[family];
  return (
    <AppText
      style={[
        tennisTextStyles.bodyLead,
        styles.description,
        { color: field.description },
      ]}
    >
      {children}
    </AppText>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      overflow: "hidden",
    },
    art: {
      ...StyleSheet.absoluteFill,
      width: "100%",
      height: "100%",
    },
    artShadow: {
      shadowColor: tennisHeroArt.heroInk,
      shadowOpacity: 0.14,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: tennisSpacing.screenX,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    mark: {
      width: 34,
      height: 34,
    },
    spacer: {
      flexGrow: 1,
      minHeight: 24,
    },
    description: {
      maxWidth: 288,
      marginBottom: 22,
    },
  }),
);
