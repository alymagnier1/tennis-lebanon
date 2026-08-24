import { StyleSheet, View, type ViewStyle } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { tennisColors } from "../../theme/tennis-tokens";

export function CourtPattern({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.grid, style]}
      pointerEvents="none"
    />
  );
}

const GRID = 38;

const styles = createLiveSheet(() =>
  StyleSheet.create({
    grid: {
      opacity: 1,
      // Simulated court grid via overlapping borders (RN has no repeating-linear-gradient)
      backgroundColor: "transparent",
      borderWidth: 0,
    },
  }),
);

/** Semi-transparent overlay blocks mimicking Figma court grid on hero screens */
export function CourtGridOverlay() {
  const lines = Array.from({ length: 12 }, (_, i) => i);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((i) => (
        <View
          key={`h-${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * GRID,
            height: 1,
            backgroundColor: tennisColors.heroBorder,
            opacity: 0.35,
          }}
        />
      ))}
      {lines.map((i) => (
        <View
          key={`v-${i}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: i * GRID,
            width: 1,
            backgroundColor: tennisColors.heroBorder,
            opacity: 0.35,
          }}
        />
      ))}
    </View>
  );
}
