import type { PropsWithChildren, RefObject } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FigmaBackButton } from "../onboarding-ui";
import { useLayoutDirection } from "../../lib/layout-direction";
import { stackScreenTopPadding } from "../../lib/stack-screen-padding";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";

export function MatchHubLayout({
  title,
  statusSlot,
  onBack,
  refreshing = false,
  onRefresh,
  scrollRef,
  dock,
  footer,
  children,
}: PropsWithChildren<{
  /** Announced on the header; time already lives on the vs-card. */
  title: string;
  /**
   * Status badge on the trailing edge. The match's state was a 12px grey
   * subtitle, which made the single most important fact on the page the
   * least visible.
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
  const { rowDirection } = useLayoutDirection();
  const topPadding = stackScreenTopPadding(insets.top);

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding,
            paddingHorizontal: tennisSpacing.screenX,
            flexDirection: rowDirection,
          },
        ]}
      >
        <FigmaBackButton onPress={onBack} />
        <View style={styles.titleBlock} accessibilityLabel={title} accessible />
        {statusSlot ? (
          <View style={styles.statusSlot}>{statusSlot}</View>
        ) : null}
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

      {dock ? (
        <View
          style={
            footer ? undefined : { paddingBottom: Math.max(insets.bottom, 8) }
          }
        >
          {dock}
        </View>
      ) : null}
      {footer}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    header: {
      alignItems: "center",
      gap: 12,
      paddingBottom: 12,
      backgroundColor: tennisColors.background,
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
    },
    statusSlot: {
      flexShrink: 0,
    },
    scroll: {
      flex: 1,
    },
    content: {
      gap: 16,
      paddingTop: 4,
    },
  }),
);
