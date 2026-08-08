import type { PropsWithChildren, RefObject } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { FigmaBackButton } from "../onboarding-ui";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function MatchHubLayout({
  title,
  subtitle,
  onBack,
  refreshing = false,
  onRefresh,
  scrollRef,
  footer,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  onBack: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollRef?: RefObject<ScrollView | null>;
  footer?: React.ReactNode;
}>) {
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();
  const topPadding = Math.max(insets.top + 12, 52);

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          { paddingTop: topPadding, paddingHorizontal: tennisSpacing.screenX },
        ]}
      >
        <FigmaBackButton onPress={onBack} />
        <View style={tennisTextStyles.titleSubtitleBlock}>
          <AppText
            accessibilityRole="header"
            style={[styles.title, { writingDirection }]}
            maxLines={2}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              style={[tennisTextStyles.pageSubtitle, { writingDirection }]}
              maxLines={2}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: tennisSpacing.screenX,
            paddingBottom: footer ? 120 : insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  header: {
    gap: 16,
    paddingBottom: 12,
    backgroundColor: tennisColors.background,
  },
  title: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 28,
    lineHeight: 32,
    color: tennisColors.primaryDark,
    letterSpacing: -0.6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 16,
    paddingTop: 4,
  },
});
