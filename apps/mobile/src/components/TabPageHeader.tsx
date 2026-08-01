import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { tennisColors } from "../theme/tennis-tokens";
import { useLayoutDirection } from "../lib/layout-direction";

export function TabPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <AppText
        accessibilityRole="header"
        style={[styles.title, { writingDirection }]}
        maxLines={2}
      >
        {title}
      </AppText>
      {description ? (
        <AppText
          style={[styles.description, { writingDirection }]}
          maxLines={3}
        >
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 12,
    gap: 4,
  },
  title: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 28,
    lineHeight: 32,
    color: tennisColors.primaryDark,
    letterSpacing: -0.6,
  },
  description: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    color: tennisColors.mutedForeground,
    maxWidth: 320,
  },
});
