import type { TextProps } from "react-native";
import { Text } from "react-native";

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
  return (
    <Text
      {...props}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      numberOfLines={maxLines}
      ellipsizeMode={maxLines ? "tail" : undefined}
      style={[{ textAlign: "auto" }, style]}
    />
  );
}
