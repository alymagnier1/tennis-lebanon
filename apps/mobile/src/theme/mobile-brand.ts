import { tennisColors } from "./tennis-tokens";

/** Mobile Figma green ramp — drop-in for @tennis-lebanon/ui `colors.brand` in AppUi/FormUi. */
export const mobileBrand = new Proxy(
  {} as {
    50: string;
    100: string;
    300: string;
    500: string;
    600: string;
    700: string;
  },
  {
    get(_target, prop) {
      switch (prop) {
        case "50":
          return tennisColors.muted;
        case "100":
          return tennisColors.secondary;
        case "300":
          return tennisColors.lime;
        case "500":
        case "600":
          return tennisColors.primary;
        case "700":
          return tennisColors.primaryDark;
        default:
          return undefined;
      }
    },
  },
);
