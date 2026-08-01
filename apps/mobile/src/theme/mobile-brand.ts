import { tennisColors } from "./tennis-tokens";

/** Mobile Figma green ramp — drop-in for @tennis-lebanon/ui `colors.brand` in AppUi/FormUi. */
export const mobileBrand = {
  50: tennisColors.muted,
  100: tennisColors.secondary,
  300: tennisColors.lime,
  500: tennisColors.primary,
  600: tennisColors.primary,
  700: tennisColors.primaryDark,
} as const;
