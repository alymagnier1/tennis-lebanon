import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { DiscoverMatchToggles } from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

type ToggleKey = keyof DiscoverMatchToggles;

const CHIP_LABEL_KEYS: Record<ToggleKey, string> = {
  matchLevel: "discover.chipMatchLevel",
  matchIntent: "discover.chipMatchIntent",
  matchArea: "discover.chipMatchArea",
  matchAvailability: "discover.chipMatchAvailability",
};

const CHIP_ORDER: ToggleKey[] = [
  "matchLevel",
  "matchIntent",
  "matchArea",
  "matchAvailability",
];

export function DiscoverMatchChips({
  toggles,
  onToggle,
}: {
  toggles: DiscoverMatchToggles;
  onToggle: (key: ToggleKey) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.chipRow}
      >
        {CHIP_ORDER.map((key) => {
          const selected = toggles[key];
          const label = t(CHIP_LABEL_KEYS[key]);

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => onToggle(key)}
              style={[styles.chip, selected ? styles.chipSelected : null]}
            >
              <AppText
                style={[
                  styles.chipLabel,
                  selected ? styles.chipLabelSelected : null,
                ]}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tennisRadii.lg,
    backgroundColor: tennisColors.muted,
  },
  chipSelected: {
    backgroundColor: tennisColors.primary,
  },
  chipLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  chipLabelSelected: {
    color: tennisColors.white,
  },
});
