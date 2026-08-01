import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../../lib/responsive";
import { tennisColors } from "../../theme/tennis-tokens";

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
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: tennisColors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tennisColors.border,
    paddingBottom: 16,
    gap: 16,
  },
});
