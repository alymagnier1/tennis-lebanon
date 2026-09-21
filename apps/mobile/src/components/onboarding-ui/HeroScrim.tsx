import { LinearGradient } from "expo-linear-gradient";
import type { ViewStyle } from "react-native";

/**
 * Colour wash over the Welcome/Done hero art.
 *
 * This used to stack opaque Views to fake a gradient, because the installed
 * `com.racketbound.app` binary predated `expo-linear-gradient` and mounting it
 * threw `Can't find ViewManager ExpoLinearGradient`. The package has been a
 * declared dependency since that same commit, so the workaround only survived
 * a stale APK — and the bands it produced were visible as hard seams across
 * the hero photo at every stop.
 *
 * Anything running this needs a dev client built after the dependency landed.
 */
export function HeroScrim({
  height,
  colors,
  locations,
  anchor,
}: {
  height: number;
  colors: readonly string[];
  locations: readonly number[];
  anchor: "top" | "bottom";
}) {
  const placement: ViewStyle = anchor === "top" ? { top: 0 } : { bottom: 0 };

  // The field tables are plain arrays; LinearGradient wants a non-empty tuple.
  // Nothing renders without at least two stops, so bail rather than assert.
  if (colors.length < 2) return null;
  const stops = colors as unknown as readonly [string, string, ...string[]];

  return (
    <LinearGradient
      colors={stops}
      locations={locations as unknown as readonly [number, number, ...number[]]}
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, right: 0, height }, placement]}
    />
  );
}
