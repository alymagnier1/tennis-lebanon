import { useWindowDimensions } from "react-native";
import {
  horizontalScreenPadding,
  isNarrowScreen,
  screenTitleFontSize,
} from "./screen-metrics";

export {
  NARROW_SCREEN_WIDTH,
  horizontalScreenPadding,
  isNarrowScreen,
  screenTitleFontSize,
} from "./screen-metrics";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const narrow = isNarrowScreen(width);

  return {
    width,
    height,
    narrow,
    horizontalPadding: horizontalScreenPadding(width),
    titleFontSize: screenTitleFontSize(width),
  };
}
