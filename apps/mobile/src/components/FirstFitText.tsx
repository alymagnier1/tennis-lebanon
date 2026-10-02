import { useState } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { AppText } from "./AppText";

/**
 * One line showing the first candidate that fits at its natural width, e.g.
 * "Alexandra Abou Jaoude" → "Alexandra J.". Candidates go longest first; if
 * none fits, the last one ellipsizes while its `suffix` ("+2") stays visible.
 * Each candidate is measured off-screen with the same style, so dynamic type
 * is accounted for.
 */
export function FirstFitText({
  candidates,
  suffix,
  style,
  containerStyle,
  rowDirection = "row",
}: {
  candidates: string[];
  /** Ending of the last candidate that must survive truncation. */
  suffix?: string;
  style: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  rowDirection?: "row" | "row-reverse";
}) {
  const [slotWidth, setSlotWidth] = useState(0);
  const [widths, setWidths] = useState<Record<string, number>>({});

  const measured =
    slotWidth > 0 && candidates.every((text) => widths[text] !== undefined);
  const fitting = measured
    ? // Web reports layout in whole pixels, so leave one pixel of headroom.
      candidates.find((text) => widths[text]! + 1 <= slotWidth)
    : candidates[0];
  const last = candidates[candidates.length - 1] ?? "";
  const keepSuffix = fitting === undefined && !!suffix && last.endsWith(suffix);

  return (
    <View
      style={[styles.slot, containerStyle]}
      onLayout={(event) => setSlotWidth(event.nativeEvent.layout.width)}
    >
      {keepSuffix ? (
        <View style={[styles.suffixRow, { flexDirection: rowDirection }]}>
          <AppText style={[style, styles.shrink]} maxLines={1}>
            {last.slice(0, -suffix.length).trimEnd()}
          </AppText>
          <AppText style={[style, styles.noShrink]} maxLines={1}>
            {suffix}
          </AppText>
        </View>
      ) : (
        <AppText style={style} maxLines={1}>
          {fitting ?? last}
        </AppText>
      )}
      <View
        style={styles.measure}
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {candidates.map((text) => (
          <View key={text} style={styles.measureRow}>
            <AppText
              style={style}
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                setWidths((prev) =>
                  prev[text] === width ? prev : { ...prev, [text]: width },
                );
              }}
            >
              {text}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    minWidth: 0,
    overflow: "hidden",
  },
  measure: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 10000,
    opacity: 0,
  },
  measureRow: {
    flexDirection: "row",
  },
  suffixRow: {
    minWidth: 0,
    gap: 4,
  },
  shrink: {
    flexShrink: 1,
  },
  noShrink: {
    flexShrink: 0,
  },
});
