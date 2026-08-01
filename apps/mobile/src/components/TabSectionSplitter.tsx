import { StyleSheet, View } from "react-native";
import type { PropsWithChildren } from "react";
import { spacing } from "@tennis-lebanon/ui";
import { AppText } from "./AppText";
import { useLayoutDirection } from "../lib/layout-direction";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { tennisColors } from "../theme/tennis-tokens";

export function TabSectionSplitter({
  label,
  showDivider = true,
}: {
  label: string;
  showDivider?: boolean;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.root}>
      {showDivider ? <View style={styles.rule} /> : null}
      <AppText style={[styles.label, { writingDirection }]}>{label}</AppText>
    </View>
  );
}

export function SplitSection({
  label,
  children,
  showDivider = true,
}: PropsWithChildren<{ label: string; showDivider?: boolean }>) {
  return (
    <View style={styles.section}>
      <TabSectionSplitter label={label} showDivider={showDivider} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
    paddingTop: 4,
    paddingBottom: 10,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tennisColors.border,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: tennisColors.mutedForeground,
  },
});
