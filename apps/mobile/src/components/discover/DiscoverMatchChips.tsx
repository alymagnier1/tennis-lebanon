import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_DISCOVER_MATCH_TOGGLES,
  type DiscoverMatchToggles,
} from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

type ToggleKey = keyof DiscoverMatchToggles;

const CHIP_LABEL_KEYS: Record<ToggleKey, string> = {
  matchLevel: "discover.chipMatchLevel",
  matchIntent: "discover.chipMatchIntent",
  matchArea: "discover.chipMatchArea",
  matchFormat: "discover.chipMatchFormat",
  matchAvailability: "discover.chipMatchAvailability",
};

const CHIP_ORDER: ToggleKey[] = [
  "matchLevel",
  "matchIntent",
  "matchArea",
  "matchFormat",
  "matchAvailability",
];

function countActiveFilters(toggles: DiscoverMatchToggles): number {
  return CHIP_ORDER.filter((key) => toggles[key]).length;
}

export function DiscoverMatchChips({
  toggles,
  onToggle,
  onClearAll,
}: {
  toggles: DiscoverMatchToggles;
  onToggle: (key: ToggleKey) => void;
  onClearAll?: () => void;
}) {
  const { t } = useTranslation();
  const activeCount = countActiveFilters(toggles);

  return (
    <View style={styles.root}>
      {activeCount > 0 ? (
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryText}>
            {t("discover.filtersActive", { count: activeCount })}
          </AppText>
          {onClearAll ? (
            <Pressable
              accessibilityRole="button"
              onPress={onClearAll}
              style={styles.clearButton}
            >
              <AppText style={styles.clearLabel}>
                {t("discover.clearFilters")}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

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

export function clearDiscoverMatchToggles(): DiscoverMatchToggles {
  return { ...DEFAULT_DISCOVER_MATCH_TOGGLES };
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryText: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
  clearButton: {
    minHeight: 32,
    justifyContent: "center",
  },
  clearLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    color: tennisColors.primary,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tennisRadii.pill,
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
