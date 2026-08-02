import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, typography } from "@tennis-lebanon/ui";
import { useLayoutDirection } from "../lib/layout-direction";

/**
 * Semantic icon names so screens never import the icon library directly.
 * Swapping icon sets later is then one file, not a repo-wide find and replace.
 */
const ICONS = {
  home: "home-outline",
  discover: "search-outline",
  matches: "tennisball-outline",
  clubs: "location-outline",
  profile: "person-outline",
  settings: "settings-outline",
  chevron: "chevron-forward",
  chevronBack: "chevron-back",
  clock: "time-outline",
  calendar: "calendar-outline",
  place: "location-outline",
  level: "stats-chart-outline",
  players: "people-outline",
  court: "tennisball-outline",
  playIntent: "ribbon-outline",
  check: "checkmark-circle",
  warning: "alert-circle-outline",
  chat: "chatbubble-ellipses-outline",
  add: "add",
  close: "close",
  filter: "options-outline",
  sort: "swap-vertical-outline",
  notifications: "notifications-outline",
  info: "information-circle-outline",
  camera: "camera-outline",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = typography.size.md,
  color = colors.neutral[500],
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { isRtl } = useLayoutDirection();

  // Directional glyphs have to mirror; the rest must not.
  const resolved =
    isRtl && name === "chevron"
      ? ICONS.chevronBack
      : isRtl && name === "chevronBack"
        ? ICONS.chevron
        : ICONS[name];

  return (
    <Ionicons
      // Decorative by default: every icon in this app sits beside a text
      // label or inside an already-labelled pressable.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      name={resolved}
      size={size}
      color={color}
    />
  );
}
