import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  colors,
  minTouchTargetPx,
  spacing,
  typography,
} from "@tennis-lebanon/ui";
import { AppText } from "./AppText";
import { useLayoutDirection } from "../lib/layout-direction";
import {
  formatStartTime12h,
  parseStartTime12hInput,
  type Meridiem,
} from "../lib/match-start-time";
import { onboardingInputStyle } from "./onboarding-ui";
import { figmaFormStyles } from "./onboarding-ui/figma-form-styles";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

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

export { timeOptions } from "../lib/match-start-time";

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
  const meridiemOptions: Meridiem[] = ["AM", "PM"];

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

  const [timeClockDraft, setTimeClockDraft] = useState(
    () => formatStartTime12h(selectedTime).clock,
  );
  const [meridiemDraft, setMeridiemDraft] = useState<Meridiem>(
    () => formatStartTime12h(selectedTime).meridiem,
  );
  const [timeInvalid, setTimeInvalid] = useState(false);

  const [syncedTime, setSyncedTime] = useState(selectedTime);

  // Re-seed the typed clock when the selected time changes from outside (a
  // suggestion tap, or the parent resetting the slot). Adjusted during render
  // rather than in an effect, which would cascade an extra pass on every edit.
  if (selectedTime !== syncedTime) {
    const formatted = formatStartTime12h(selectedTime);
    setSyncedTime(selectedTime);
    setTimeClockDraft(formatted.clock);
    setMeridiemDraft(formatted.meridiem);
    setTimeInvalid(false);
  }

  const freeAtSelectedTime =
    availability?.[`${selectedDay} ${selectedTime}`] ?? 0;

  const commitTime = (clock: string, meridiem: Meridiem) => {
    const parsed = parseStartTime12hInput(clock, meridiem);
    if (!parsed.ok) {
      setTimeInvalid(true);
      return;
    }
    setTimeInvalid(false);
    const formatted = formatStartTime12h(parsed.time);
    setTimeClockDraft(formatted.clock);
    setMeridiemDraft(formatted.meridiem);
    onSelectTime(parsed.time);
  };

  const selectMeridiem = (meridiem: Meridiem) => {
    setMeridiemDraft(meridiem);
    setTimeInvalid(false);
    commitTime(timeClockDraft, meridiem);
  };

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
              style={[styles.dayChip, selected && figmaFormStyles.chipSelected]}
            >
              <AppText
                style={[
                  styles.dayWeekday,
                  selected && figmaFormStyles.chipTextSelected,
                ]}
                maxLines={1}
              >
                {day.isToday ? t("slotPicker.today") : day.weekday}
              </AppText>
              <AppText
                style={[
                  styles.dayNumber,
                  selected && figmaFormStyles.chipTextSelected,
                ]}
                maxLines={1}
              >
                {day.dayOfMonth}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <AppText style={styles.label}>{t("slotPicker.time")}</AppText>
      <View style={[styles.timeRow, { flexDirection: rowDirection }]}>
        <TextInput
          accessibilityLabel={t("slotPicker.time")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          placeholder={t("slotPicker.timePlaceholder")}
          placeholderTextColor={tennisColors.mutedForeground}
          returnKeyType="done"
          style={[
            onboardingInputStyle.input,
            styles.timeInput,
            timeInvalid && styles.timeInputInvalid,
          ]}
          value={timeClockDraft}
          onBlur={() => commitTime(timeClockDraft, meridiemDraft)}
          onChangeText={(value) => {
            setTimeClockDraft(value);
            setTimeInvalid(false);
          }}
          onSubmitEditing={() => commitTime(timeClockDraft, meridiemDraft)}
        />
        <View style={[styles.meridiemRow, { flexDirection: rowDirection }]}>
          {meridiemOptions.map((period) => {
            const selected = period === meridiemDraft;
            return (
              <Pressable
                key={period}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(`slotPicker.meridiem.${period}`)}
                onPress={() => selectMeridiem(period)}
                style={[
                  styles.meridiemChip,
                  selected && figmaFormStyles.chipSelected,
                ]}
              >
                <AppText
                  style={[
                    styles.meridiemText,
                    selected && figmaFormStyles.chipTextSelected,
                  ]}
                  maxLines={1}
                >
                  {t(`slotPicker.meridiem.${period}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {timeInvalid ? (
        <AppText style={styles.timeError} maxLines={2}>
          {t("slotPicker.timeInvalid")}
        </AppText>
      ) : (
        <AppText style={styles.timeHint} maxLines={2}>
          {t("slotPicker.timeHint")}
        </AppText>
      )}
      {freeAtSelectedTime > 0 && !timeInvalid ? (
        <AppText style={styles.timeAvailability} maxLines={1}>
          {t("slotPicker.playersFree", { count: freeAtSelectedTime })}
        </AppText>
      ) : null}

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
              style={[
                styles.durationChip,
                selected && figmaFormStyles.chipSelected,
              ]}
            >
              <AppText
                style={[
                  styles.durationText,
                  selected && figmaFormStyles.chipTextSelected,
                ]}
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
  root: { gap: spacing.md },
  label: figmaFormStyles.fieldLabel,
  dayRow: { gap: 10, paddingVertical: spacing.xs },
  dayChip: {
    minWidth: 56,
    minHeight: minTouchTargetPx + 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: spacing.md,
    borderRadius: tennisRadii.md,
    borderWidth: 2,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  dayWeekday: {
    fontFamily: tennisFontFamily.body,
    color: tennisColors.mutedForeground,
    fontSize: typography.size.xs,
  },
  dayNumber: {
    fontFamily: tennisFontFamily.headingSemi,
    color: tennisColors.primaryDark,
    fontSize: typography.size.md,
  },
  timeInputInvalid: {
    borderColor: colors.danger[500],
  },
  timeRow: {
    alignItems: "stretch",
    gap: spacing.sm,
  },
  timeInput: {
    flex: 1,
    minWidth: 0,
  },
  meridiemRow: {
    gap: 10,
  },
  meridiemChip: {
    minWidth: 52,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: tennisRadii.md,
    borderWidth: 2,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  meridiemText: {
    fontFamily: tennisFontFamily.headingSemi,
    color: tennisColors.primaryDark,
    fontSize: 13,
  },
  timeHint: {
    fontFamily: tennisFontFamily.body,
    color: tennisColors.mutedForeground,
    fontSize: typography.size.xs,
  },
  timeError: {
    fontFamily: tennisFontFamily.body,
    color: colors.danger[700],
    fontSize: typography.size.xs,
  },
  timeAvailability: {
    fontFamily: tennisFontFamily.bodyMedium,
    color: tennisColors.primary,
    fontSize: typography.size.xs,
  },
  durationRow: { gap: 10 },
  durationChip: {
    flex: 1,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: tennisRadii.md,
    borderWidth: 2,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  durationText: {
    fontFamily: tennisFontFamily.headingSemi,
    color: tennisColors.primaryDark,
    fontSize: 13,
    textAlign: "center",
  },
});
