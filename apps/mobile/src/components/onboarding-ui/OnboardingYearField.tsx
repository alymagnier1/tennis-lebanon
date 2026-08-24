import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { useLayoutDirection } from "../../lib/layout-direction";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

const ROW_HEIGHT = 52;

/**
 * A year chosen from a list rather than typed.
 *
 * A free-text year invites the failures a picker cannot have -- three digits,
 * a typo two decades out, a keyboard covering the field -- and none of them are
 * caught until the step is submitted. The list also makes the eligible range
 * self-evident: it starts at the youngest year that can join, so an underage
 * player sees the boundary instead of being told about it after the fact.
 *
 * The list opens in a modal rather than inline because `OnboardingStepLayout`
 * already scrolls, and a seventy-row scroller nested inside a scrolling page
 * fights the parent on both platforms.
 */
export function OnboardingYearField({
  value,
  onChange,
  minYear,
  maxYear,
  label,
  placeholder,
}: {
  value: string;
  onChange: (year: string) => void;
  minYear: number;
  maxYear: number;
  label: string;
  placeholder: string;
}) {
  const { t } = useTranslation();
  const { rowDirection } = useLayoutDirection();
  const [open, setOpen] = useState(false);

  // Newest first: the youngest eligible year is the one most people need, and
  // it puts the eligibility boundary at the top where it reads as a rule.
  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
      list.push(year);
    }
    return list;
  }, [maxYear, minYear]);

  const selectedIndex = years.findIndex((year) => String(year) === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={value ? { text: value } : undefined}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          { flexDirection: rowDirection },
          pressed && styles.triggerPressed,
        ]}
      >
        <AppText
          style={value ? styles.triggerValue : styles.triggerPlaceholder}
        >
          {value || placeholder}
        </AppText>
        <Icon
          name="chevronDown"
          size={18}
          color={tennisColors.mutedForeground}
        />
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        >
          {/* Swallows taps so a press inside the sheet never closes it. */}
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <AppText style={styles.sheetTitle}>{label}</AppText>
            <FlatList
              data={years}
              keyExtractor={(year) => String(year)}
              initialScrollIndex={selectedIndex > 0 ? selectedIndex : undefined}
              getItemLayout={(_, index) => ({
                length: ROW_HEIGHT,
                offset: ROW_HEIGHT * index,
                index,
              })}
              renderItem={({ item }) => {
                const selected = String(item) === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(String(item));
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      { flexDirection: rowDirection },
                      selected && styles.rowSelected,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <AppText
                      style={
                        selected ? styles.rowLabelSelected : styles.rowLabel
                      }
                    >
                      {item}
                    </AppText>
                    {selected ? (
                      <Icon
                        name="check"
                        size={18}
                        color={tennisColors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    trigger: {
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: 12,
      backgroundColor: tennisColors.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: minTouchTargetPx,
    },
    triggerPressed: {
      borderColor: tennisColors.primary,
    },
    triggerValue: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 15,
      color: tennisColors.primaryDark,
    },
    triggerPlaceholder: {
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      color: tennisColors.mutedForeground,
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(13,28,20,0.45)",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    sheet: {
      maxHeight: "70%",
      backgroundColor: tennisColors.card,
      borderRadius: tennisRadii.xl,
      paddingVertical: 8,
      overflow: "hidden",
    },
    sheetTitle: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 16,
      color: tennisColors.primaryDark,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    row: {
      height: ROW_HEIGHT,
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
    },
    rowSelected: {
      backgroundColor: tennisColors.secondary,
    },
    rowPressed: {
      backgroundColor: tennisColors.muted,
    },
    rowLabel: {
      fontFamily: tennisFontFamily.body,
      fontSize: 16,
      color: tennisColors.primaryDark,
    },
    rowLabelSelected: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 16,
      color: tennisColors.primary,
    },
  }),
);
