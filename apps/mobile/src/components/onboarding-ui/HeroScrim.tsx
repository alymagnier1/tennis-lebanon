import { View, type ViewStyle } from "react-native";

/**
 * Banded colour wash used on Welcome/Done heroes.
 *
 * The design handoff prefers `expo-linear-gradient`, but that native view is
 * not in the currently installed `com.racketbound.app` binary — mounting it
 * throws `Can't find ViewManager ExpoLinearGradient` and the emulator ANRs.
 * Overlapping Views match the stop colours closely enough until a native
 * rebuild picks up the module.
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

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          height,
        },
        placement,
      ]}
    >
      {colors.map((color, index) => {
        const start = locations[index] ?? 0;
        const end = locations[index + 1] ?? 1;
        const bandHeight = Math.max(0, height * (end - start));
        if (bandHeight < 1) return null;
        return (
          <View
            key={`${color}-${index}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: height * start,
              height: bandHeight,
              backgroundColor: color,
            }}
          />
        );
      })}
    </View>
  );
}
