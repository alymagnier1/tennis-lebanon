import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import type { DiscoverMatchToggles } from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { notify } from "../../lib/confirm-action";
import { ensureLocaleResources } from "../../lib/i18n";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { LOCALE_BUNDLE_ID } from "@tennis-lebanon/i18n";

// Keep this screen on the same Metro graph as locale JSON edits.
void LOCALE_BUNDLE_ID;
ensureLocaleResources();

type ToggleKey = keyof DiscoverMatchToggles;

const CHIP_LABEL_KEYS: Record<ToggleKey, string> = {
  matchLevel: "discover.chipMatchLevel",
  matchArea: "discover.chipMatchArea",
  matchAvailability: "discover.chipMatchAvailability",
};

const CHIP_ORDER: ToggleKey[] = [
  "matchLevel",
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
  const { rowDirection } = useLayoutDirection();

  return (
    <View style={[styles.root, { flexDirection: rowDirection }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("discover.matchFiltersHelpA11y")}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() =>
          notify(
            t("discover.matchFiltersHelpTitle"),
            t("discover.matchFiltersHelpBody"),
          )
        }
        style={styles.infoButton}
      >
        <Icon name="info" size={22} color={tennisColors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      alignItems: "center",
      gap: 4,
    },
    chipScroll: {
      flexGrow: 1,
      flexShrink: 1,
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
    infoButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);
