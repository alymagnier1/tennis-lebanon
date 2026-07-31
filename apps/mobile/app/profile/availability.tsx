import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listOwnAvailability,
  setRecurringAvailability,
  type RecurringAvailabilityInput,
} from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import {
  FormField,
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";
import {
  beirutLocalToUtcIso,
  formatUtcInBeirut,
} from "../../src/lib/beirut-time";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "../../src/lib/supabase";

type AvailabilityMode = "recurring" | "oneOff";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Coarse blocks rather than free-text times. Availability overlap is the
 * primary discovery signal and needs at least an hour of shared time, so
 * three-hour blocks are both easier to tap and more likely to intersect.
 */
const TIME_BLOCKS = [
  { id: "morning", local_start: "07:00", local_end: "12:00" },
  { id: "afternoon", local_start: "12:00", local_end: "17:00" },
  { id: "evening", local_start: "17:00", local_end: "22:00" },
] as const;

type BlockId = (typeof TIME_BLOCKS)[number]["id"];

/** `${weekday}:${blockId}` */
type CellKey = string;

function cellKey(weekday: number, block: BlockId): CellKey {
  return `${weekday}:${block}`;
}

function selectionToWindows(
  selected: Set<CellKey>,
): RecurringAvailabilityInput[] {
  const windows: RecurringAvailabilityInput[] = [];
  for (const weekday of WEEKDAYS) {
    for (const block of TIME_BLOCKS) {
      if (selected.has(cellKey(weekday, block.id))) {
        windows.push({
          weekday,
          local_start: block.local_start,
          local_end: block.local_end,
        });
      }
    }
  }
  return windows;
}

/** Maps saved rows back onto grid cells, matching on the block boundaries. */
function windowsToSelection(
  rows: {
    is_recurring: boolean;
    weekday: number | null;
    local_start: string | null;
  }[],
): Set<CellKey> {
  const selected = new Set<CellKey>();
  for (const row of rows) {
    if (!row.is_recurring || row.weekday == null || !row.local_start) continue;
    const start = row.local_start.slice(0, 5);
    const block = TIME_BLOCKS.find((entry) => entry.local_start === start);
    if (block) {
      selected.add(cellKey(row.weekday, block.id));
    }
  }
  return selected;
}

const PRESETS = {
  weekdayEvenings: [1, 2, 3, 4, 5].map((d) => cellKey(d, "evening")),
  weekendMornings: [0, 6].map((d) => cellKey(d, "morning")),
} as const;

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const [mode, setMode] = useState<AvailabilityMode>("recurring");
  // Null until the user edits, so the grid is derived from the server instead
  // of being synced into state by an effect.
  const [localSelection, setLocalSelection] = useState<Set<CellKey> | null>(
    null,
  );
  const [oneOffDate, setOneOffDate] = useState("");
  const [oneOffStart, setOneOffStart] = useState("18:00");
  const [oneOffEnd, setOneOffEnd] = useState("21:00");

  const availabilityQuery = useQuery({
    queryKey: ["own-availability", userId],
    queryFn: () => listOwnAvailability(supabase),
    enabled: Boolean(userId),
  });

  const serverSelection = useMemo(
    () => windowsToSelection(availabilityQuery.data ?? []),
    [availabilityQuery.data],
  );
  const selected = localSelection ?? serverSelection;

  const oneOffWindows = useMemo(
    () => (availabilityQuery.data ?? []).filter((w) => !w.is_recurring),
    [availabilityQuery.data],
  );

  const invalidateDiscovery = async () => {
    await queryClient.invalidateQueries({ queryKey: ["own-availability"] });
    await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
  };

  const saveGrid = useMutation({
    mutationFn: () =>
      setRecurringAvailability(supabase, selectionToWindows(selected)),
    onSuccess: invalidateDiscovery,
    onError: () => Alert.alert(t("availability.saveError")),
  });

  const addOneOff = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Authentication required");
      if (!oneOffDate) throw new Error("Date required");
      return createAvailabilityWindow(supabase, {
        user_id: userId,
        starts_at: beirutLocalToUtcIso(oneOffDate, oneOffStart),
        ends_at: beirutLocalToUtcIso(oneOffDate, oneOffEnd),
        timezone: "Asia/Beirut",
        is_recurring: false,
      });
    },
    onSuccess: async () => {
      await invalidateDiscovery();
      setOneOffDate("");
    },
    onError: () => Alert.alert(t("availability.saveError")),
  });

  const removeWindow = useMutation({
    mutationFn: (windowId: string) =>
      deleteAvailabilityWindow(supabase, windowId),
    onSuccess: invalidateDiscovery,
    onError: () => Alert.alert(t("availability.saveError")),
  });

  const toggleCell = (weekday: number, block: BlockId) => {
    setLocalSelection((current) => {
      const next = new Set(current ?? serverSelection);
      const key = cellKey(weekday, block);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  /** Toggles a whole preset: clears it if every cell is already selected. */
  const applyPreset = (keys: readonly CellKey[]) => {
    setLocalSelection((current) => {
      const next = new Set(current ?? serverSelection);
      const allSet = keys.every((key) => next.has(key));
      for (const key of keys) {
        if (allSet) {
          next.delete(key);
        } else {
          next.add(key);
        }
      }
      return next;
    });
  };

  const selectedCount = selected.size;

  return (
    <Screen
      title={t("availability.title")}
      description={t("availability.description")}
      refreshing={availabilityQuery.isFetching}
      onRefresh={() => void availabilityQuery.refetch()}
    >
      {availabilityQuery.isLoading ? (
        <ActivityIndicator accessibilityLabel={t("availability.loading")} />
      ) : null}
      {availabilityQuery.isError ? (
        <Text style={formStyles.errorText}>{t("availability.loadError")}</Text>
      ) : null}

      <View style={formStyles.segmentRow}>
        <PressableSegment
          label={t("availability.recurringTab")}
          selected={mode === "recurring"}
          onPress={() => setMode("recurring")}
        />
        <PressableSegment
          label={t("availability.oneOffTab")}
          selected={mode === "oneOff"}
          onPress={() => setMode("oneOff")}
        />
      </View>

      {mode === "recurring" ? (
        <View style={formStyles.card}>
          <Text style={formStyles.title}>{t("availability.gridTitle")}</Text>
          <Text style={formStyles.description}>
            {t("availability.gridHelp")}
          </Text>

          <View style={styles.presetRow}>
            <SecondaryButton
              label={t("availability.presetWeekdayEvenings")}
              onPress={() => applyPreset(PRESETS.weekdayEvenings)}
            />
            <SecondaryButton
              label={t("availability.presetWeekendMornings")}
              onPress={() => applyPreset(PRESETS.weekendMornings)}
            />
          </View>

          <View style={styles.headerRow}>
            <View style={styles.dayLabelCell} />
            {TIME_BLOCKS.map((block) => (
              <Text key={block.id} style={styles.blockHeading}>
                {t(`availability.blocks.${block.id}`)}
              </Text>
            ))}
          </View>

          {WEEKDAYS.map((weekday) => (
            <View key={weekday} style={styles.gridRow}>
              <Text style={styles.dayLabelCell} numberOfLines={1}>
                {t(`availability.weekdaysShort.${weekday}`)}
              </Text>
              {TIME_BLOCKS.map((block) => {
                const isSelected = selected.has(cellKey(weekday, block.id));
                return (
                  <Pressable
                    key={block.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${t(`availability.weekdays.${weekday}`)} ${t(`availability.blocks.${block.id}`)}`}
                    onPress={() => toggleCell(weekday, block.id)}
                    style={[styles.cell, isSelected && styles.cellSelected]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isSelected && styles.cellTextSelected,
                      ]}
                    >
                      {isSelected ? "✓" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Text style={styles.count}>
            {t("availability.selectedCount", { count: selectedCount })}
          </Text>

          <PrimaryButton
            label={t("availability.saveGrid")}
            loading={saveGrid.isPending}
            onPress={() => saveGrid.mutate()}
          />
          {saveGrid.isSuccess ? (
            <Text style={styles.saved}>{t("availability.saved")}</Text>
          ) : null}
        </View>
      ) : (
        <View style={formStyles.card}>
          <Text style={formStyles.title}>{t("availability.addWindow")}</Text>
          {oneOffWindows.map((window) => (
            <View key={window.id} style={styles.oneOffRow}>
              <Text style={formStyles.summaryValue}>
                {t("availability.oneOffLabel", {
                  start: window.starts_at
                    ? formatUtcInBeirut(window.starts_at)
                    : "",
                  end: window.ends_at ? formatUtcInBeirut(window.ends_at) : "",
                })}
              </Text>
              <SecondaryButton
                label={t("availability.remove")}
                onPress={() => removeWindow.mutate(window.id)}
              />
            </View>
          ))}

          <FormField
            label={t("availability.date")}
            value={oneOffDate}
            onChangeText={setOneOffDate}
            placeholder="2026-07-25"
            autoCapitalize="none"
          />
          <FormField
            label={t("availability.startTime")}
            value={oneOffStart}
            onChangeText={setOneOffStart}
            placeholder="18:00"
            autoCapitalize="none"
          />
          <FormField
            label={t("availability.endTime")}
            value={oneOffEnd}
            onChangeText={setOneOffEnd}
            placeholder="21:00"
            autoCapitalize="none"
          />
          <PrimaryButton
            label={t("availability.addWindow")}
            loading={addOneOff.isPending}
            onPress={() => addOneOff.mutate()}
          />
        </View>
      )}

      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}

function PressableSegment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        formStyles.segmentButton,
        selected && formStyles.segmentButtonActive,
      ]}
    >
      <Text style={formStyles.segmentButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  presetRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dayLabelCell: {
    width: 44,
    color: colors.neutral[700],
    fontSize: typography.size.sm,
  },
  blockHeading: {
    flex: 1,
    textAlign: "center",
    color: colors.neutral[500],
    fontSize: typography.size.xs,
  },
  cell: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.md,
    backgroundColor: colors.neutral[100],
  },
  cellSelected: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[600],
  },
  cellText: {
    fontSize: typography.size.md,
    color: colors.neutral[500],
  },
  cellTextSelected: {
    color: colors.neutral[0],
    fontWeight: typography.weight.semibold,
  },
  count: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.neutral[500],
    fontSize: typography.size.sm,
  },
  saved: {
    marginTop: spacing.sm,
    color: colors.brand[700],
    fontSize: typography.size.sm,
  },
  oneOffRow: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
});
