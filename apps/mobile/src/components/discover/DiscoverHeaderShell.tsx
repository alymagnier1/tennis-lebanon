import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../../lib/responsive";
import { tennisColors } from "../../theme/tennis-tokens";
import { tabRootHeaderPaddingTop } from "../../lib/tab-root-header";

/**
 * Full-bleed white header block with a bottom border — matches Figma Discover
 * (filters on card surface, results on the page background below).
 */
export function DiscoverHeaderShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsiveLayout();
  const edgePadding = Math.max(horizontalPadding, insets.left, insets.right);

  return (
    <View
      style={[
        styles.shell,
        {
          marginHorizontal: -edgePadding,
          paddingHorizontal: edgePadding,
          paddingTop: tabRootHeaderPaddingTop(insets.top),
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    shell: {
      backgroundColor: tennisColors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tennisColors.border,
      paddingBottom: 16,
      gap: 16,
    },
  }),
);
