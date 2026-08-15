import type { PropsWithChildren, RefObject } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { FigmaBackButton } from "../onboarding-ui";
import { useLayoutDirection } from "../../lib/layout-direction";
import { stackScreenTopPadding } from "../../lib/stack-screen-padding";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function MatchHubLayout({
  title,
  subtitle,
  statusSlot,
  onBack,
  refreshing = false,
  onRefresh,
  scrollRef,
  dock,
  footer,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  /**
   * Status badge under the title. The match's state was a 12px grey subtitle,
   * which made the single most important fact on the page the least visible.
   */
  statusSlot?: React.ReactNode;
  onBack: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollRef?: RefObject<ScrollView | null>;
  /** Sticky region above the action bar (e.g. match chat). */
  dock?: React.ReactNode;
  footer?: React.ReactNode;
}>) {
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();
  const topPadding = stackScreenTopPadding(insets.top);

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
          {statusSlot ? (
            <View style={styles.statusSlot}>{statusSlot}</View>
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
            paddingBottom: dock || footer ? 24 : insets.bottom + 24,
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

      {dock}
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
  statusSlot: {
    alignSelf: "flex-start",
    marginTop: 6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 16,
    paddingTop: 4,
  },
});
