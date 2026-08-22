import { useMemo, useState } from "react";
import { notify } from "../../src/lib/confirm-action";
import { availabilitySelectionChanged } from "../../src/lib/availability-selection";
import { useToast } from "../../src/providers/ToastProvider";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listOwnAvailability,
  setRecurringAvailability,
  type RecurringAvailabilityInput,
} from "@tennis-lebanon/api";
import { SegmentTabs } from "../../src/components/AppUi";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import { Icon } from "../../src/components/Icon";
import { TabSectionSplitter } from "../../src/components/TabSectionSplitter";
import {
  FigmaCard,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  OnboardingFormField,
  OnboardingStepLayout,
  onboardingInputStyle,
} from "../../src/components/onboarding-ui";
import {
  beirutLocalToUtcIso,
  formatUtcInBeirut,
} from "../../src/lib/beirut-time";
import { formatAvailabilitySectionLabel } from "../../src/lib/availability-section-label";
import { exitProfileScreen } from "../../src/lib/navigation";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "../../src/lib/supabase";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../src/theme/tennis-tokens";

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

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const userId = session?.user.id;
  const [mode, setMode] = useState<AvailabilityMode>("recurring");
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
    onSuccess: async () => {
      // Refetch first, then drop the local copy. Clearing it before the server
      // answers would fall back to the pre-save grid for a frame.
      await invalidateDiscovery();
      setLocalSelection(null);
      showToast(t("availability.saved"));
    },
    onError: () => notify(t("availability.saveError")),
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
    onError: () => notify(t("availability.saveError")),
  });

  const removeWindow = useMutation({
    mutationFn: (windowId: string) =>
      deleteAvailabilityWindow(supabase, windowId),
    onSuccess: invalidateDiscovery,
    onError: () => notify(t("availability.saveError")),
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

  // Content comparison, not "has the user tapped anything": toggling a cell on
  // and back off again leaves local state populated with nothing to save.
  const gridChanged = availabilitySelectionChanged(selected, serverSelection);

  const sectionCount =
    mode === "recurring" ? selected.size : oneOffWindows.length;

  const footer =
    mode === "recurring" ? (
      <FigmaPrimaryButton
        label={t("availability.saveGrid")}
        disabled={!gridChanged || saveGrid.isPending}
        loading={saveGrid.isPending}
        onPress={() => saveGrid.mutate()}
      />
    ) : (
      <FigmaPrimaryButton
        label={t("availability.addWindow")}
        // Without a date this threw "Date required" straight into the generic
        // save-failed alert, which reads as a bug rather than a missing field.
        disabled={!oneOffDate || addOneOff.isPending}
        loading={addOneOff.isPending}
        onPress={() => addOneOff.mutate()}
      />
    );

  return (
    <OnboardingStepLayout
      title={t("availability.title")}
      onBack={() => exitProfileScreen()}
      footer={footer}
    >
      {availabilityQuery.isLoading ? (
        <ActivityIndicator
          color={tennisColors.primary}
          accessibilityLabel={t("availability.loading")}
        />
      ) : null}

      {availabilityQuery.isError ? (
        <ErrorNotice>{t("availability.loadError")}</ErrorNotice>
      ) : null}

      <SegmentTabs
        value={mode}
        options={[
          { value: "recurring", label: t("availability.recurringTab") },
          { value: "oneOff", label: t("availability.oneOffTab") },
        ]}
        onChange={setMode}
      />

      {!availabilityQuery.isLoading && !availabilityQuery.isError ? (
        <TabSectionSplitter
          label={formatAvailabilitySectionLabel(mode, sectionCount, t)}
        />
      ) : null}

      {mode === "recurring" ? (
        <FigmaCard style={styles.card}>
          <View style={[styles.headerRow, { flexDirection: rowDirection }]}>
            <View style={styles.dayLabelCell} />
            {TIME_BLOCKS.map((block) => (
              <AppText
                key={block.id}
                style={[styles.blockHeading, { writingDirection }]}
              >
                {t(`availability.blocks.${block.id}`)}
              </AppText>
            ))}
          </View>

          {WEEKDAYS.map((weekday) => (
            <View
              key={weekday}
              style={[styles.gridRow, { flexDirection: rowDirection }]}
            >
              <AppText
                style={[styles.dayLabelCell, { writingDirection }]}
                maxLines={1}
              >
                {t(`availability.weekdaysShort.${weekday}`)}
              </AppText>
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
                    {isSelected ? (
                      <Icon name="check" size={18} color={tennisColors.lime} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </FigmaCard>
      ) : (
        <View style={styles.oneOffStack}>
          {oneOffWindows.length > 0 ? (
            <FigmaCard style={styles.card}>
              {oneOffWindows.map((window) => (
                <View key={window.id} style={styles.oneOffRow}>
                  <AppText style={styles.oneOffLabel}>
                    {t("availability.oneOffLabel", {
                      start: window.starts_at
                        ? formatUtcInBeirut(window.starts_at)
                        : "",
                      end: window.ends_at
                        ? formatUtcInBeirut(window.ends_at)
                        : "",
                    })}
                  </AppText>
                  <FigmaSecondaryButton
                    label={t("availability.remove")}
                    onPress={() => removeWindow.mutate(window.id)}
                  />
                </View>
              ))}
            </FigmaCard>
          ) : null}

          <FigmaCard style={styles.card}>
            <OnboardingFormField label={t("availability.date")}>
              <TextInput
                accessibilityLabel={t("availability.date")}
                value={oneOffDate}
                onChangeText={setOneOffDate}
                placeholder="2026-07-25"
                autoCapitalize="none"
                style={onboardingInputStyle.input}
              />
            </OnboardingFormField>
            <OnboardingFormField label={t("availability.startTime")}>
              <TextInput
                accessibilityLabel={t("availability.startTime")}
                value={oneOffStart}
                onChangeText={setOneOffStart}
                placeholder="18:00"
                autoCapitalize="none"
                style={onboardingInputStyle.input}
              />
            </OnboardingFormField>
            <OnboardingFormField label={t("availability.endTime")}>
              <TextInput
                accessibilityLabel={t("availability.endTime")}
                value={oneOffEnd}
                onChangeText={setOneOffEnd}
                placeholder="21:00"
                autoCapitalize="none"
                style={onboardingInputStyle.input}
              />
            </OnboardingFormField>
          </FigmaCard>
        </View>
      )}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  headerRow: {
    alignItems: "center",
    gap: 6,
  },
  gridRow: {
    alignItems: "center",
    gap: 6,
  },
  dayLabelCell: {
    width: 36,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
  blockHeading: {
    flex: 1,
    textAlign: "center",
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 11,
    color: tennisColors.mutedForeground,
  },
  cell: {
    flex: 1,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    borderRadius: tennisRadii.md,
    backgroundColor: tennisColors.muted,
  },
  cellSelected: {
    borderColor: tennisColors.primary,
    backgroundColor: tennisColors.primary,
  },
  oneOffStack: {
    gap: 12,
  },
  oneOffRow: {
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  oneOffLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primaryDark,
  },
});
