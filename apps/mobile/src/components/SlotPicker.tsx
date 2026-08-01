import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  colors,
  minTouchTargetPx,
  radii,
  semantic,
  spacing,
  typography,
} from "@tennis-lebanon/ui";
import { AppText } from "./AppText";
import { useLayoutDirection } from "../lib/layout-direction";

/** Half-hour steps across the window a club is plausibly open. */
const START_HOUR = 7;
const END_HOUR = 21;

export const DURATION_OPTIONS = [60, 90, 120] as const;
export type DurationMinutes = (typeof DURATION_OPTIONS)[number];

export type SlotAvailability = Record<string, number>;

function startOfBeirutDay(offsetDays: number): Date {
  // Anchor on the Beirut calendar day rather than the device's, so a user
  // travelling or on a device set to UTC still sees Lebanese dates.
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = nowParts.split("-").map(Number);
  const base = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base;
}

export function dayKey(offsetDays: number): string {
  return startOfBeirutDay(offsetDays).toISOString().slice(0, 10);
}

/** `HH:MM` in half-hour steps. */
export function timeOptions(): string[] {
  const out: string[] = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
    out.push(`${String(hour).padStart(2, "0")}:00`);
    if (hour !== END_HOUR) out.push(`${String(hour).padStart(2, "0")}:30`);
  }
  return out;
}

export function addMinutes(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Day, time and duration by tapping. This replaced three free-text fields
 * where the user typed `2026-07-25`, `18:00` and `19:30` by hand.
 *
 * `availability` maps `YYYY-MM-DD HH:MM` to how many compatible players are
 * free then, so the picker shows where the match is actually likely to fill
 * rather than making the host guess.
 */
export function SlotPicker({
  dayCount = 10,
  selectedDay,
  onSelectDay,
  selectedTime,
  onSelectTime,
  duration,
  onSelectDuration,
  availability,
}: {
  dayCount?: number;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  selectedTime: string;
  onSelectTime: (time: string) => void;
  duration: DurationMinutes;
  onSelectDuration: (duration: DurationMinutes) => void;
  availability?: SlotAvailability;
}) {
  const { t, i18n } = useTranslation();
  const { rowDirection } = useLayoutDirection();

  const days = useMemo(() => {
    const weekday = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
      timeZone: "Asia/Beirut",
      weekday: "short",
    });
    return Array.from({ length: dayCount }, (_, offset) => {
      const date = startOfBeirutDay(offset);
      return {
        key: date.toISOString().slice(0, 10),
        weekday: weekday.format(date),
        dayOfMonth: String(date.getUTCDate()),
        isToday: offset === 0,
      };
    });
  }, [dayCount, i18n.resolvedLanguage]);

  const times = useMemo(() => timeOptions(), []);

  return (
    <View style={styles.root}>
      <AppText style={styles.label}>{t("slotPicker.day")}</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.dayRow, { flexDirection: rowDirection }]}
      >
        {days.map((day) => {
          const selected = day.key === selectedDay;
          return (
            <Pressable
              key={day.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${day.weekday} ${day.dayOfMonth}`}
              onPress={() => onSelectDay(day.key)}
              style={[styles.dayChip, selected && styles.chipSelected]}
            >
              <AppText
                style={[styles.dayWeekday, selected && styles.textSelected]}
                maxLines={1}
              >
                {day.isToday ? t("slotPicker.today") : day.weekday}
              </AppText>
              <AppText
                style={[styles.dayNumber, selected && styles.textSelected]}
                maxLines={1}
              >
                {day.dayOfMonth}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <AppText style={styles.label}>{t("slotPicker.time")}</AppText>
      <View style={styles.timeGrid}>
        {times.map((time) => {
          const selected = time === selectedTime;
          const free = availability?.[`${selectedDay} ${time}`] ?? 0;
          return (
            <Pressable
              key={time}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={
                free > 0
                  ? t("slotPicker.timeWithPlayers", { time, count: free })
                  : time
              }
              onPress={() => onSelectTime(time)}
              style={[
                styles.timeChip,
                free > 0 && styles.timeChipAvailable,
                selected && styles.chipSelected,
              ]}
            >
              <AppText
                style={[styles.timeText, selected && styles.textSelected]}
                maxLines={1}
              >
                {time}
              </AppText>
              {free > 0 ? (
                <AppText
                  style={[styles.timeFree, selected && styles.textSelected]}
                  maxLines={1}
                >
                  {t("slotPicker.playersFree", { count: free })}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <AppText style={styles.label}>{t("slotPicker.duration")}</AppText>
      <View style={[styles.durationRow, { flexDirection: rowDirection }]}>
        {DURATION_OPTIONS.map((option) => {
          const selected = option === duration;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t("slotPicker.minutes", { count: option })}
              onPress={() => onSelectDuration(option)}
              style={[styles.durationChip, selected && styles.chipSelected]}
            >
              <AppText
                style={[styles.durationText, selected && styles.textSelected]}
                maxLines={1}
              >
                {t("slotPicker.minutes", { count: option })}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  label: {
    color: semantic.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  dayRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  dayChip: {
    minWidth: 56,
    minHeight: minTouchTargetPx + 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.surface,
  },
  dayWeekday: {
    color: semantic.textTertiary,
    fontSize: typography.size.xs,
  },
  dayNumber: {
    color: semantic.textPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  timeChip: {
    minWidth: 84,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.surface,
  },
  /** Slots where someone compatible is actually free are worth surfacing. */
  timeChipAvailable: {
    borderColor: colors.success[100],
    backgroundColor: colors.success[50],
  },
  timeText: {
    color: semantic.textPrimary,
    fontSize: typography.size.md,
  },
  timeFree: {
    color: colors.success[700],
    fontSize: typography.size.xs,
  },
  durationRow: { gap: spacing.sm },
  durationChip: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.surface,
  },
  durationText: {
    color: semantic.textPrimary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  chipSelected: {
    borderColor: semantic.interactive,
    backgroundColor: colors.brand[50],
  },
  textSelected: {
    color: colors.brand[700],
    fontWeight: typography.weight.semibold,
  },
});
