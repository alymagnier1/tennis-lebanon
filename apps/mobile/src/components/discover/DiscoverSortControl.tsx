import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { BottomSheet, SheetOption } from "../AppUi";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import {
  DISCOVER_SORT_MODES,
  type DiscoverSortMode,
} from "../../lib/discover-sort";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

const SORT_LABEL_KEYS: Record<DiscoverSortMode, string> = {
  recommended: "discover.sortRecommended",
  level: "discover.sortLevel",
  area: "discover.sortZone",
  availability: "discover.sortAvailability",
};

export function DiscoverSortControl({
  value,
  onChange,
}: {
  value: DiscoverSortMode;
  onChange: (next: DiscoverSortMode) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection } = useLayoutDirection();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("discover.sortBy")}
        accessibilityHint={t(SORT_LABEL_KEYS[value])}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          { flexDirection: rowDirection },
          pressed && styles.triggerPressed,
        ]}
      >
        <Icon name="sort" size={16} color={tennisColors.primary} />
        <AppText style={styles.triggerLabel} maxLines={1}>
          {t(SORT_LABEL_KEYS[value])}
        </AppText>
      </Pressable>

      <BottomSheet
        visible={open}
        title={t("discover.sortBy")}
        onClose={() => setOpen(false)}
      >
        <View style={styles.options}>
          {DISCOVER_SORT_MODES.map((mode) => (
            <SheetOption
              key={mode}
              label={t(SORT_LABEL_KEYS[mode])}
              selected={value === mode}
              onPress={() => {
                onChange(mode);
                setOpen(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    trigger: {
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
      borderRadius: tennisRadii.lg,
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      flexShrink: 0,
    },
    triggerPressed: {
      opacity: 0.88,
    },
    triggerLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.primaryDark,
    },
    options: {
      gap: 8,
    },
  }),
);
