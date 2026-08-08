import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../AppText";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

export function PlayerProfileSection({
  title,
  variant = "card",
  children,
}: PropsWithChildren<{
  title: string;
  variant?: "card" | "grouped";
}>) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.card}>
      <AppText
        style={[
          variant === "grouped" ? styles.groupedTitle : styles.title,
          { writingDirection },
        ]}
      >
        {title}
      </AppText>
      <View style={variant === "grouped" ? styles.groupedBody : styles.body}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tennisColors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    overflow: "hidden",
  },
  title: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 0,
  },
  groupedTitle: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 12,
    color: tennisColors.mutedForeground,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 18,
    gap: 10,
  },
  groupedBody: {
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
  },
});
