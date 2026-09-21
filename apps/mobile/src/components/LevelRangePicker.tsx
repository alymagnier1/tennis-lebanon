import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { minTouchTargetPx, spacing } from "@tennis-lebanon/ui";
import type { SkillBand } from "@tennis-lebanon/domain";
import { isSkillBandSelected } from "@tennis-lebanon/domain";
import { useLayoutDirection } from "../lib/layout-direction";
import { AppText } from "./AppText";
import { figmaFormStyles } from "./onboarding-ui/figma-form-styles";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

/**
 * Skill bands wrap instead of hiding in a horizontal scroller — a flush-cut
 * row with `showsHorizontalScrollIndicator={false}` looked like Intermediate
 * was the last option.
 */
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
  const { writingDirection, rowDirection } = useLayoutDirection();

  return (
    <View style={styles.levelSection}>
      {label ? (
        <AppText style={[figmaFormStyles.fieldLabel, { writingDirection }]}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.levelRow, { flexDirection: rowDirection }]}>
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
              style={[
                styles.levelChip,
                isSelected && figmaFormStyles.chipSelected,
              ]}
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
                  isSelected && figmaFormStyles.chipTextSelected,
                  { writingDirection },
                ]}
                maxLines={1}
              >
                {band.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    levelSection: {
      overflow: "visible",
    },
    levelRow: {
      flexWrap: "wrap",
      gap: 10,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
    levelChip: {
      minHeight: minTouchTargetPx,
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 2,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.md,
      backgroundColor: tennisColors.card,
    },
    levelChipText: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 13,
      color: tennisColors.primaryDark,
      textAlign: "center",
    },
    yourLevelBadge: {
      position: "absolute",
      top: -11,
      alignSelf: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: tennisRadii.pill,
      backgroundColor: tennisColors.primaryDark,
    },
    yourLevelBadgeText: {
      fontFamily: tennisFontFamily.bodySemi,
      color: tennisColors.white,
      fontSize: 11,
      lineHeight: 14,
    },
  }),
);
