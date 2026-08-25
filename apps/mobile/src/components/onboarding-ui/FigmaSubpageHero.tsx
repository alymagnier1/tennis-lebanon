import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { FigmaBackButton } from "./FigmaButtons";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";

export function FigmaSubpageHero({
  title,
  description,
  onBack,
  children,
}: PropsWithChildren<{
  title: string;
  description?: string;
  onBack?: () => void;
  children?: ReactNode;
}>) {
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();
  const heroTopPadding = Math.max(insets.top + 16, 52);

  return (
    <View style={[styles.hero, { paddingTop: heroTopPadding }]}>
      <View style={styles.content}>
        {onBack ? <FigmaBackButton onPress={onBack} /> : null}
        <View style={tennisTextStyles.titleSubtitleBlock}>
          <AppText
            accessibilityRole="header"
            style={[
              styles.title,
              !onBack && styles.titleWithoutBack,
              { writingDirection },
            ]}
          >
            {title}
          </AppText>
          {description ? (
            <AppText
              style={[
                tennisTextStyles.sectionSubtitle,
                { writingDirection },
              ]}
            >
              {description}
            </AppText>
          ) : null}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    hero: {
      backgroundColor: tennisColors.background,
      paddingHorizontal: 20,
      paddingBottom: 24,
      overflow: "hidden",
    },
    content: {
      position: "relative",
      zIndex: 1,
      gap: 0,
    },
    title: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 28,
      lineHeight: 31,
      color: tennisColors.primaryDark,
      letterSpacing: -0.6,
      marginTop: 16,
      marginBottom: 0,
    },
    titleWithoutBack: {
      marginTop: 0,
    },
  }),
);
