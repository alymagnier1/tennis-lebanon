import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../AppText";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

export function PlayerProfileSection({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.card}>
      <AppText style={[styles.title, { writingDirection }]}>{title}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.xl,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
});
