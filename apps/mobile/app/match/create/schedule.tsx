import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  listMyMatches,
  suggestMatchTimes,
  getActiveZones,
  listOwnPreferredZoneIds,
} from "@tennis-lebanon/api";
import {
  hasReachedHostedMatchCap,
  listOnDiscoverFromVisibility,
  visibilityFromListOnDiscover,
} from "@tennis-lebanon/domain";
import type { TimingMode } from "@tennis-lebanon/domain";
import {
  AnimatedCollapse,
  SettingToggle,
  StatusBanner,
} from "../../../src/components/AppUi";
import { AppText } from "../../../src/components/AppText";
import { PreferredClubPicker } from "../../../src/components/PreferredClubPicker";
import { CreateMatchSummaryBar } from "../../../src/components/match/CreateMatchSummaryBar";
import {
  CreateMatchStepLayout,
  FigmaChipMulti,
  FigmaChipRow,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  figmaFormStyles,
  onboardingInputStyle,
} from "../../../src/components/onboarding-ui";
import { ErrorNotice } from "../../../src/components/FormUi";
import {
  addMinutes,
  dayKey,
  nearestDuration,
  SlotPicker,
  type DurationMinutes,
  type SlotAvailability,
} from "../../../src/components/SlotPicker";
import {
  beirutLocalToUtcIso,
  utcIsoToBeirutFields,
} from "../../../src/lib/beirut-time";
import {
  createMatchStyles,
  CreateMatchPanel,
  CreateMatchSection,
  CreateMatchSubsection,
  CreateMatchSubsectionDivider,
  CreateMatchSummaryValue,
} from "../../../src/lib/create-match-ui";
import {
  getCreateMatchDraft,
  updateCreateMatchDraft,
} from "../../../src/lib/create-match-draft";
import { notify } from "../../../src/lib/confirm-action";
import { zoneNameFromJson } from "../../../src/lib/zones";
import {
  favoriteClubIdsFromDirectory,
  seedFavoriteClubIds,
  seedZoneIdsFromProfile,
  shouldPromoteWhereEditing,
  shouldSeedFavoriteClubs,
  shouldShowWhereEditor,
  whereSectionHydrated,
} from "../../../src/lib/schedule-prefill";
import { useClubsDirectory } from "../../../src/hooks/useClubsDirectory";
import { usePublishMatch } from "../../../src/hooks/usePublishMatch";
import { showMatchCapAlert } from "../../../src/lib/create-match-guard";
import { MATCHES_ROUTE } from "../../../src/lib/routes";
import { supabase } from "../../../src/lib/supabase";
import { tennisColors } from "../../../src/theme/tennis-tokens";

const MAX_PREFERRED_CLUBS = 3;

type SlotDraft = {
  day: string;
  startTime: string;
  duration: DurationMinutes;
};

function defaultSlot(): SlotDraft {
  return { day: dayKey(2), startTime: "18:00", duration: 90 };
}

function slotsFromDraft(): SlotDraft[] {
  const draft = getCreateMatchDraft();
  if (!draft.proposedTimes?.length) {
    return [defaultSlot()];
  }

  return draft.proposedTimes.map((slot) => {
    const { date, time } = utcIsoToBeirutFields(slot.startsAt);
    const durationMinutes = Math.max(
      1,
      Math.round(
        (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) /
          60_000,
      ),
    );

    return {
      day: date,
      startTime: time,
      duration: nearestDuration(durationMinutes),
    };
  });
}

export default function CreateMatchScheduleScreen() {
  const { t, i18n } = useTranslation();
  // The draft is module state with no subscription, so returning from the
  // per-match overrides screen would otherwise leave the summary bar, the
  // active-hosted guard and the time suggestions reading the old format.
  const [draftRevision, setDraftRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setDraftRevision((value) => value + 1);
    }, []),
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read on refocus
  const draft = useMemo(() => getCreateMatchDraft(), [draftRevision]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>(
    draft.zoneIds ?? [],
  );
  const [timingMode, setTimingMode] = useState<TimingMode>(
    draft.timingMode ?? "fixed",
  );
  const [slots, setSlots] = useState<SlotDraft[]>(slotsFromDraft);
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>(
    draft.preferredClubIds ?? [],
  );
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [showNotes, setShowNotes] = useState(Boolean(draft.notes));
  const [listOnDiscover, setListOnDiscover] = useState(() =>
    listOnDiscoverFromVisibility(draft.visibility),
  );
  const [requiresApproval, setRequiresApproval] = useState(
    draft.requiresCreatorApproval ?? false,
  );
  const [editingWhere, setEditingWhere] = useState(false);
  const [editingJoin, setEditingJoin] = useState(false);
  // Captured once, from the profile-hydrated draft. While the host has not
  // moved off their saved defaults there is nothing to decide here, so the
  // panel stays a one-line summary instead of two always-open toggles.
  const [defaultListOnDiscover] = useState(() =>
    listOnDiscoverFromVisibility(draft.visibility),
  );
  const [defaultRequiresApproval] = useState(
    () => draft.requiresCreatorApproval ?? false,
  );
  const [showMoreOptions, setShowMoreOptions] = useState(
    draft.timingMode === "flexible",
  );
  const [publishError, setPublishError] = useState<string | null>(null);

  // Set only when this draft exists to ask one named player. Publishing is the
  // wrong word for it: the draft is invite_only, so nobody else ever sees it.
  const requestForName =
    draft.inviteForPlayer && draft.targetPlayerName
      ? draft.targetPlayerName
      : null;

  const clubsRequired = listOnDiscover;

  const myMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });

  // A count now, not a collision: three matches on the go is the whole rule,
  // whatever their format or visibility.
  const capReached = useMemo(
    () => hasReachedHostedMatchCap(myMatchesQuery.data ?? []),
    [myMatchesQuery.data],
  );

  const { publish, isPublishing } = usePublishMatch({
    onValidationError: setPublishError,
  });

  const zonesQuery = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const preferredZonesQuery = useQuery({
    queryKey: ["own-preferred-zones"],
    queryFn: () => listOwnPreferredZoneIds(supabase),
  });

  const [zonesHydrated, setZonesHydrated] = useState(
    Boolean(draft.zoneIds?.length),
  );

  useEffect(() => {
    if (zonesHydrated || !zonesQuery.data || !preferredZonesQuery.isSuccess) {
      return;
    }

    const seeded = seedZoneIdsFromProfile(
      draft.zoneIds,
      preferredZonesQuery.data,
      zonesQuery.data.map((zone) => zone.id),
    );
    queueMicrotask(() => {
      if (seeded.length > 0) {
        setSelectedZoneIds(seeded);
      }
      setZonesHydrated(true);
    });
  }, [
    draft.zoneIds,
    preferredZonesQuery.data,
    preferredZonesQuery.isSuccess,
    zonesHydrated,
    zonesQuery.data,
  ]);

  const clubsQuery = useClubsDirectory(selectedZoneIds);

  const [clubsHydrated, setClubsHydrated] = useState(
    Boolean(draft.preferredClubIds?.length),
  );

  useEffect(() => {
    if (clubsHydrated || !clubsQuery.data || selectedZoneIds.length === 0) {
      return;
    }

    const seeded = seedFavoriteClubIds(
      draft.preferredClubIds,
      favoriteClubIdsFromDirectory(clubsQuery.data),
    );
    queueMicrotask(() => {
      if (seeded.length > 0) {
        setSelectedClubIds(seeded);
      }
      setClubsHydrated(true);
    });
  }, [
    clubsHydrated,
    clubsQuery.data,
    draft.preferredClubIds,
    selectedZoneIds.length,
  ]);

  const effectiveClubIds = useMemo(() => {
    const available = clubsQuery.data;
    if (!available) return selectedClubIds;
    return selectedClubIds.filter((id) =>
      available.some((club) => club.club_id === id),
    );
  }, [clubsQuery.data, selectedClubIds]);

  const zoneOptions = useMemo(
    () =>
      (zonesQuery.data ?? []).map((zone) => ({
        value: zone.id,
        label: zoneNameFromJson(
          zone.name_i18n,
          i18n.resolvedLanguage ?? i18n.language,
        ),
      })),
    [i18n.language, i18n.resolvedLanguage, zonesQuery.data],
  );

  const selectedClubLabels = useMemo(() => {
    const clubs = clubsQuery.data ?? [];
    return effectiveClubIds
      .map((id) => clubs.find((club) => club.club_id === id)?.name)
      .filter((name): name is string => Boolean(name));
  }, [clubsQuery.data, effectiveClubIds]);

  const selectedAreaLabels = useMemo(
    () =>
      zoneOptions
        .filter((zone) => selectedZoneIds.includes(zone.value))
        .map((zone) => zone.label),
    [selectedZoneIds, zoneOptions],
  );

  const whereSummaryReady =
    selectedZoneIds.length > 0 &&
    (effectiveClubIds.length > 0 || !clubsRequired);

  const whereHydrated = whereSectionHydrated({
    zonesHydrated,
    clubsHydrated,
    clubsSettled: clubsQuery.isSuccess || clubsQuery.isError,
  });

  // Incomplete Where forces the editor open with editingWhere still false.
  // Promote to explicit edit so the first club that completes the summary
  // does not collapse the picker before the host taps Done.
  if (
    shouldPromoteWhereEditing({
      editingWhere,
      whereHydrated,
      whereSummaryReady,
    })
  ) {
    setEditingWhere(true);
  }

  const showWhereEditor = shouldShowWhereEditor({
    editingWhere,
    whereHydrated,
    whereSummaryReady,
  });

  function closeWhereEditor() {
    if (selectedZoneIds.length === 0) return;
    if (clubsRequired && effectiveClubIds.length === 0) return;
    setEditingWhere(false);
  }

  const joinSettingsAtDefault =
    listOnDiscover === defaultListOnDiscover &&
    requiresApproval === defaultRequiresApproval;
  const showJoinEditor = editingJoin || !joinSettingsAtDefault;

  const joinSummary = [
    listOnDiscover
      ? t("matches.create.summaryDiscover")
      : t("matches.create.summaryInviteOnly"),
    ...(listOnDiscover && requiresApproval
      ? [t("matches.create.summaryApproval")]
      : []),
  ].join(" · ");

  function selectTimingMode(next: TimingMode) {
    setTimingMode(next);
    if (next === "fixed") {
      setSlots((current) => [current[0] ?? defaultSlot()]);
    }
  }

  useEffect(() => {
    const proposedTimes = slots.map((slot) => {
      const endTime = addMinutes(slot.startTime, slot.duration);
      return {
        startsAt: beirutLocalToUtcIso(slot.day, slot.startTime),
        endsAt: beirutLocalToUtcIso(slot.day, endTime),
      };
    });

    updateCreateMatchDraft({
      zoneIds: selectedZoneIds,
      preferredClubIds: effectiveClubIds,
      proposedTimes,
      timingMode,
      notes: notes.trim() || undefined,
      visibility: visibilityFromListOnDiscover(listOnDiscover),
      requiresCreatorApproval: listOnDiscover ? requiresApproval : false,
    });
  }, [
    effectiveClubIds,
    listOnDiscover,
    notes,
    requiresApproval,
    selectedZoneIds,
    slots,
    timingMode,
  ]);

  const suggestionsQuery = useQuery({
    queryKey: ["match-time-suggestions", selectedZoneIds, draft.format],
    queryFn: () =>
      suggestMatchTimes(supabase, {
        zoneIds: selectedZoneIds,
        format: draft.format ?? null,
        limit: 40,
        slotMinutes: slots[0]?.duration ?? 90,
      }),
    enabled: selectedZoneIds.length > 0 && Boolean(draft.format),
  });

  const availability = useMemo<SlotAvailability>(() => {
    const map: SlotAvailability = {};
    for (const slot of suggestionsQuery.data ?? []) {
      if (slot.candidate_count <= 0) continue;
      const { date, time } = utcIsoToBeirutFields(slot.starts_at);
      map[`${date} ${time}`] = slot.candidate_count;
    }
    return map;
  }, [suggestionsQuery.data]);

  function toggleZone(zoneId: string) {
    setSelectedZoneIds((current) =>
      current.includes(zoneId)
        ? current.filter((id) => id !== zoneId)
        : [...current, zoneId],
    );
  }

  function toggleClub(clubId: string) {
    const alreadyPicked = effectiveClubIds.includes(clubId);
    if (!alreadyPicked && effectiveClubIds.length >= MAX_PREFERRED_CLUBS) {
      return;
    }
    setSelectedClubIds((current) =>
      current.includes(clubId)
        ? current.filter((id) => id !== clubId)
        : [...current, clubId],
    );
  }

  function updateSlot(index: number, patch: Partial<SlotDraft>) {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  }

  function addSlot() {
    if (slots.length >= 3) return;
    setSlots((current) => [...current, defaultSlot()]);
  }

  function handlePublish(destination: "invite" | "hub") {
    setPublishError(null);

    if (selectedZoneIds.length === 0) {
      notify(t("matches.create.zoneRequired"));
      return;
    }

    if (clubsRequired && effectiveClubIds.length === 0) {
      notify(t("matches.create.clubRequired"));
      return;
    }

    if (capReached) {
      showMatchCapAlert(t);
      return;
    }

    publish(destination, notes, {
      seedFavoriteClubs: shouldSeedFavoriteClubs(clubsQuery.data),
    });
  }

  // A cold landing here — deep link, notification, restored navigation state —
  // has no draft to render. Returning null left a blank screen with no header
  // and no way back, so hand the user to the orchestrator, which hydrates.
  if (!draft.format) {
    return <Redirect href="/match/create" />;
  }

  return (
    <CreateMatchStepLayout
      title={t("matches.create.scheduleTitle")}
      onBack={() => router.back()}
      footer={
        <>
          {publishError ? <ErrorNotice>{publishError}</ErrorNotice> : null}
          <AppText style={createMatchStyles.hint}>
            {requestForName
              ? t("matches.create.sendRequestHint", { name: requestForName })
              : listOnDiscover
                ? t("matches.create.publishActionsHint")
                : t("matches.create.publishPrivateHint")}
          </AppText>
          <FigmaPrimaryButton
            label={
              requestForName
                ? t("matches.create.sendRequest", { name: requestForName })
                : t("matches.create.publish")
            }
            loading={isPublishing}
            disabled={capReached}
            onPress={() => handlePublish("hub")}
          />
          {/* Hidden when a specific player is being asked. "invite" skips both
              publishMatch and createMatchInvite, so on that path the button
              named after the goal was the one button that never reached it. */}
          {requestForName ? null : (
            <FigmaSecondaryButton
              label={t("matches.invite.invitePlayers")}
              disabled={isPublishing || capReached}
              onPress={() => handlePublish("invite")}
            />
          )}
        </>
      }
    >
      {capReached ? (
        <StatusBanner
          body={t("matches.create.capReachedBody")}
          actions={
            <FigmaSecondaryButton
              label={t("matches.create.seeMyMatches")}
              onPress={() => router.push(MATCHES_ROUTE)}
            />
          }
        />
      ) : null}

      <View style={figmaFormStyles.stack}>
        <CreateMatchSummaryBar
          onPress={() => router.push("/match/create/details")}
        />

        <CreateMatchPanel title={t("matches.create.summaryWhen")}>
          {slots.map((slot, index) => {
            const picker = (
              <SlotPicker
                selectedDay={slot.day}
                onSelectDay={(day) => updateSlot(index, { day })}
                selectedTime={slot.startTime}
                onSelectTime={(startTime) => updateSlot(index, { startTime })}
                duration={slot.duration}
                onSelectDuration={(duration) => updateSlot(index, { duration })}
                availability={availability}
              />
            );

            if (timingMode === "flexible") {
              return (
                <CreateMatchSection
                  key={`slot-${index}`}
                  label={t("matches.create.slotLabel", { index: index + 1 })}
                >
                  {picker}
                </CreateMatchSection>
              );
            }

            return <View key={`slot-${index}`}>{picker}</View>;
          })}

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowMoreOptions((value) => !value)}
          >
            <AppText style={createMatchStyles.addSlot}>
              {showMoreOptions
                ? t("matches.create.moreOptionsHide")
                : t("matches.create.moreOptionsShow")}
            </AppText>
          </Pressable>

          <AnimatedCollapse visible={showMoreOptions}>
            <CreateMatchSection label={t("matches.create.timingModeTitle")}>
              <FigmaChipRow
                value={timingMode}
                options={[
                  { value: "fixed", label: t("matches.create.timingFixed") },
                  {
                    value: "flexible",
                    label: t("matches.create.timingFlexible"),
                  },
                ]}
                onChange={selectTimingMode}
              />
            </CreateMatchSection>

            {timingMode === "flexible" && slots.length < 3 ? (
              <Pressable accessibilityRole="button" onPress={addSlot}>
                <AppText style={createMatchStyles.addSlot}>
                  {t("matches.create.addSlot")}
                </AppText>
              </Pressable>
            ) : null}
          </AnimatedCollapse>
        </CreateMatchPanel>

        <CreateMatchPanel
          title={t("matches.create.summaryWhere")}
          actionLabel={
            !whereHydrated
              ? undefined
              : showWhereEditor && whereSummaryReady
                ? t("common.done")
                : showWhereEditor
                  ? undefined
                  : t("matches.create.whereEditForMatch")
          }
          onAction={
            !whereHydrated
              ? undefined
              : showWhereEditor && whereSummaryReady
                ? closeWhereEditor
                : showWhereEditor
                  ? undefined
                  : () => setEditingWhere(true)
          }
        >
          {!whereHydrated ? (
            <ActivityIndicator color={tennisColors.primary} />
          ) : showWhereEditor ? (
            <>
              <AppText style={createMatchStyles.hint}>
                {t("matches.create.whereEditDisclaimer")}
              </AppText>

              <CreateMatchSubsection label={t("discover.zonesFilter")}>
                <FigmaChipMulti
                  options={zoneOptions}
                  values={selectedZoneIds}
                  onToggle={toggleZone}
                />
              </CreateMatchSubsection>

              <CreateMatchSubsectionDivider />

              <CreateMatchSubsection
                label={t("matches.create.preferredClubsForMatchTitle")}
              >
                {selectedZoneIds.length === 0 ? (
                  <AppText style={createMatchStyles.hint}>
                    {t("matches.create.preferredClubsPickZoneFirst")}
                  </AppText>
                ) : (
                  <>
                    <AppText style={createMatchStyles.hint}>
                      {t("matches.create.preferredClubsListingOnly")}
                    </AppText>
                    <PreferredClubPicker
                      clubs={clubsQuery.data ?? []}
                      selectedClubIds={effectiveClubIds}
                      onToggle={toggleClub}
                    />
                  </>
                )}
              </CreateMatchSubsection>
            </>
          ) : (
            <>
              <CreateMatchSubsection label={t("discover.zonesFilter")}>
                <CreateMatchSummaryValue>
                  <AppText style={createMatchStyles.summaryValue}>
                    {selectedAreaLabels.join(" · ")}
                  </AppText>
                </CreateMatchSummaryValue>
              </CreateMatchSubsection>

              <CreateMatchSubsectionDivider />

              <CreateMatchSubsection
                label={t("matches.create.preferredClubsForMatchTitle")}
              >
                <CreateMatchSummaryValue empty={effectiveClubIds.length === 0}>
                  <AppText
                    style={
                      effectiveClubIds.length > 0
                        ? createMatchStyles.summaryValue
                        : createMatchStyles.hint
                    }
                  >
                    {effectiveClubIds.length > 0
                      ? selectedClubLabels.join(" · ")
                      : t("matches.create.preferredClubsNone")}
                  </AppText>
                </CreateMatchSummaryValue>
              </CreateMatchSubsection>

              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t(
                  "matches.create.whereProfileDefaultsLink",
                )}
                onPress={() => router.push("/profile/where-i-play")}
              >
                <AppText style={createMatchStyles.profileLink}>
                  {t("matches.create.whereProfileDefaultsLink")}
                </AppText>
              </Pressable>
            </>
          )}
        </CreateMatchPanel>

        <CreateMatchPanel
          title={t("matches.create.joinSettingsSection")}
          actionLabel={showJoinEditor ? undefined : t("common.change")}
          onAction={showJoinEditor ? undefined : () => setEditingJoin(true)}
        >
          {showJoinEditor ? (
            <>
              <SettingToggle
                variant="card"
                label={t("matches.create.listOnDiscover")}
                value={listOnDiscover}
                onValueChange={(value) => {
                  setListOnDiscover(value);
                  if (!value) {
                    setRequiresApproval(false);
                  }
                }}
              />
              <AnimatedCollapse visible={listOnDiscover}>
                <SettingToggle
                  variant="card"
                  label={t("matches.create.requiresApprovalShort")}
                  value={requiresApproval}
                  onValueChange={setRequiresApproval}
                />
              </AnimatedCollapse>
            </>
          ) : (
            <CreateMatchSummaryValue>
              <AppText style={createMatchStyles.summaryValue}>
                {joinSummary}
              </AppText>
            </CreateMatchSummaryValue>
          )}
        </CreateMatchPanel>

        <CreateMatchSection label={t("matches.create.notes")}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowNotes((value) => !value)}
          >
            <AppText style={createMatchStyles.addSlot}>
              {showNotes
                ? t("matches.create.notesHide")
                : t("matches.create.notesAdd")}
            </AppText>
          </Pressable>
          <AnimatedCollapse visible={showNotes}>
            <TextInput
              accessibilityLabel={t("matches.create.notes")}
              multiline
              placeholderTextColor={tennisColors.mutedForeground}
              style={[onboardingInputStyle.input, createMatchStyles.notesInput]}
              value={notes}
              onChangeText={setNotes}
            />
          </AnimatedCollapse>
        </CreateMatchSection>
      </View>
    </CreateMatchStepLayout>
  );
}
