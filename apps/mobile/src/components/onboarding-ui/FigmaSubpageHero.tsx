import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { CourtGridOverlay } from "./CourtPattern";
import { FigmaBackButton } from "./FigmaButtons";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";

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
      <CourtGridOverlay />
      <View style={styles.content}>
        {onBack ? <FigmaBackButton onPress={onBack} onDark /> : null}
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
          <AppText style={[styles.description, { writingDirection }]}>
            {description}
          </AppText>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: tennisColors.primary,
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
    color: tennisColors.white,
    letterSpacing: -0.6,
    marginTop: 16,
  },
  titleWithoutBack: {
    marginTop: 0,
  },
  description: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.65)",
    marginTop: 6,
    marginBottom: 16,
  },
});
