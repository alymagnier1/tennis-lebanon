import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { tennisColors } from "../theme/tennis-tokens";
import { tennisTextStyles } from "../theme/tennis-text-styles";
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
      <View style={tennisTextStyles.titleSubtitleBlock}>
        <AppText
          accessibilityRole="header"
          style={[styles.title, { writingDirection }]}
          maxLines={2}
        >
          {title}
        </AppText>
        {description ? (
          <AppText
            style={[tennisTextStyles.pageSubtitle, { writingDirection }]}
            maxLines={3}
          >
            {description}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 12,
  },
  title: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 28,
    lineHeight: 32,
    color: tennisColors.primaryDark,
    letterSpacing: -0.6,
  },
});
