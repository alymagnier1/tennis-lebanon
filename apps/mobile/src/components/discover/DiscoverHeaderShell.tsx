import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../../lib/responsive";
import { tennisColors } from "../../theme/tennis-tokens";
import { tabRootHeaderPaddingTop } from "../../lib/tab-root-header";

/**
 * Full-bleed header block with a bottom border — filters sit on the page
 * background (same as the screen), not a white card slab.
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
      backgroundColor: tennisColors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tennisColors.border,
      paddingBottom: 16,
      gap: 16,
    },
  }),
);
