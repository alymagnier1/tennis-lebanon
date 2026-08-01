import type { PropsWithChildren, RefObject } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SegmentTabs } from "../AppUi";
import { AppText } from "../AppText";
import { FigmaBackButton } from "../onboarding-ui";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

type HubSection = "overview" | "vote" | "chat" | "book";

export function MatchHubLayout({
  title,
  subtitle,
  activeSection,
  onSectionChange,
  onBack,
  refreshing = false,
  onRefresh,
  scrollRef,
  sectionTabs,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  activeSection: HubSection;
  onSectionChange: (section: HubSection) => void;
  onBack: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollRef?: RefObject<ScrollView | null>;
  sectionTabs: { value: HubSection; label: string }[];
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
        <View style={styles.titleBlock}>
          <AppText
            accessibilityRole="header"
            style={[styles.title, { writingDirection }]}
            maxLines={2}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              style={[styles.subtitle, { writingDirection }]}
              maxLines={2}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <SegmentTabs
          value={activeSection}
          options={sectionTabs}
          onChange={onSectionChange}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: tennisSpacing.screenX,
            paddingBottom: insets.bottom + 24,
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
  titleBlock: {
    gap: 4,
  },
  title: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 28,
    lineHeight: 32,
    color: tennisColors.primaryDark,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 16,
    paddingTop: 4,
  },
});
