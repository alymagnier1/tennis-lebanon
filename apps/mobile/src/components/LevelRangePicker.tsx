import { ScrollView, Pressable, StyleSheet, View } from "react-native";
import { minTouchTargetPx, spacing } from "@tennis-lebanon/ui";
import type { SkillBand } from "@tennis-lebanon/domain";
import { isSkillBandSelected } from "@tennis-lebanon/domain";
import { useLayoutDirection } from "../lib/layout-direction";
import { AppText } from "./AppText";
import { figmaFormStyles } from "./onboarding-ui/figma-form-styles";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

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
        <AppText style={[figmaFormStyles.fieldLabel, { writingDirection }]}>
          {label}
        </AppText>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.levelRow}
        style={styles.levelScroll}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  levelSection: {
    overflow: "visible",
  },
  levelScroll: {
    overflow: "visible",
  },
  levelRow: {
    gap: 10,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    paddingRight: spacing.sm,
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
    fontSize: 10,
  },
});
