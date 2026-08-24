import type { TextProps } from "react-native";
import { Text } from "react-native";
import { useTennisTheme } from "../providers/ThemeProvider";

const DEFAULT_MAX_FONT_SCALE = 1.3;

export function AppText({
  maxLines,
  maxFontSizeMultiplier = DEFAULT_MAX_FONT_SCALE,
  style,
  ...props
}: TextProps & {
  maxLines?: number;
  maxFontSizeMultiplier?: number;
}) {
  const { colors } = useTennisTheme();
  return (
    <Text
      {...props}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      numberOfLines={maxLines}
      ellipsizeMode={maxLines ? "tail" : undefined}
      style={[{ color: colors.primaryDark, textAlign: "auto" }, style]}
    />
  );
}
