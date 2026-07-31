import { ScrollView, Pressable, StyleSheet, View } from "react-native";
import {
  colors,
  minTouchTargetPx,
  radii,
  spacing,
  typography,
} from "@tennis-lebanon/ui";
import type { SkillBand } from "@tennis-lebanon/domain";
import { isSkillBandSelected } from "@tennis-lebanon/domain";
import { useLayoutDirection } from "../lib/layout-direction";
import { AppText } from "./AppText";

export function LevelRangePicker({
  label,
  bands,
  selected,
  onToggle,
  yourLevel,
  yourLevelLabel,
}: {
  label?: string;
  bands: { value: SkillBand; label: string }[];
  selected: SkillBand[];
  onToggle: (band: SkillBand) => void;
  yourLevel?: SkillBand | null;
  yourLevelLabel?: string;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.levelSection}>
      {label ? (
        <AppText style={[styles.levelSectionLabel, { writingDirection }]}>
          {label}
        </AppText>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.levelRow}
      >
        {bands.map((band) => {
          const isSelected = isSkillBandSelected(band.value, selected);
          const isYourLevel = yourLevel === band.value;

          return (
            <Pressable
              key={band.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={band.label}
              onPress={() => onToggle(band.value)}
              style={[styles.levelChip, isSelected && styles.levelChipSelected]}
            >
              {isYourLevel && yourLevelLabel ? (
                <View style={styles.yourLevelBadge}>
                  <AppText style={styles.yourLevelBadgeText} maxLines={1}>
                    {yourLevelLabel}
                  </AppText>
                </View>
              ) : null}
              <AppText
                style={[
                  styles.levelChipText,
                  isSelected && styles.levelChipTextSelected,
                  { writingDirection },
                ]}
                maxLines={1}
              >
                {band.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  levelSection: {
    gap: spacing.sm,
  },
  levelSectionLabel: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  levelRow: {
    gap: spacing.xs,
    paddingVertical: 2,
    paddingRight: spacing.sm,
  },
  levelChip: {
    minHeight: minTouchTargetPx,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.md,
    backgroundColor: colors.neutral[0],
  },
  levelChipSelected: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  levelChipText: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    textAlign: "center",
  },
  levelChipTextSelected: {
    color: colors.brand[700],
    fontWeight: typography.weight.semibold,
  },
  yourLevelBadge: {
    position: "absolute",
    top: -8,
    alignSelf: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[900],
  },
  yourLevelBadgeText: {
    color: colors.neutral[0],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
