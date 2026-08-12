import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOwnPlayerProfile,
  updateMatchHostDefaults,
} from "@tennis-lebanon/api";
import {
  matchFormatSchema,
  matchHostDefaultsRowFromProfile,
  ORDERED_SKILL_BANDS,
  resolveMatchHostDefaults,
  skillRangeFromSelection,
  toggleSkillBandSelection,
  type PlayIntent,
  type SkillBand,
} from "@tennis-lebanon/domain";
import { AnimatedCollapse, SettingToggle } from "../../src/components/AppUi";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import { LevelRangePicker } from "../../src/components/LevelRangePicker";
import { ChipButton, figmaFormStyles, OnboardingStepLayout } from "../../src/components/onboarding-ui";
import { useAuth } from "../../src/providers/AuthProvider";
import { CreateMatchPanel } from "../../src/lib/create-match-ui";
import { supabase } from "../../src/lib/supabase";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

const intents: PlayIntent[] = ["social", "competitive", "either"];

/**
 * Every chip is a full save, and dragging a level range crosses several bands
 * in a second. Without this each tap raced its neighbours and the last response
 * won rather than the last tap.
 */
const SAVE_DEBOUNCE_MS = 600;

type DefaultsState = {
  playIntent: PlayIntent;
  prefersSingles: boolean;
  prefersDoubles: boolean;
  defaultFormat: "singles" | "doubles";
  selectedBands: SkillBand[];
  listOnDiscover: boolean;
  requiresApproval: boolean;
};

function draftBandsFromProfile(
  profile: Awaited<ReturnType<typeof getOwnPlayerProfile>>,
): SkillBand[] {
  const row = matchHostDefaultsRowFromProfile(profile);
  const resolved = resolveMatchHostDefaults(row);
  return resolved.selectedSkillBands;
}

function stateFromProfile(
  profile: Awaited<ReturnType<typeof getOwnPlayerProfile>>,
  resolved: ReturnType<typeof resolveMatchHostDefaults> | null,
): DefaultsState {
  const parsedFormat = matchFormatSchema.safeParse(profile.default_match_format);
  return {
    playIntent: profile.play_intent as PlayIntent,
    prefersSingles: profile.prefers_singles,
    prefersDoubles: profile.prefers_doubles,
    defaultFormat: parsedFormat.success
      ? parsedFormat.data
      : (resolved?.format ?? "singles"),
    selectedBands: draftBandsFromProfile(profile),
    listOnDiscover: profile.default_match_visibility === "public",
    requiresApproval: profile.default_requires_creator_approval,
  };
}

export default function MatchDefaultsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["own-player-profile", session?.user.id],
    queryFn: () => getOwnPlayerProfile(supabase),
    enabled: Boolean(session),
  });

  const profile = profileQuery.data;
  const resolved = useMemo(
    () =>
      profile
        ? resolveMatchHostDefaults(matchHostDefaultsRowFromProfile(profile))
        : null,
    [profile],
  );

  const [playIntent, setPlayIntent] = useState<PlayIntent>("either");
  const [prefersSingles, setPrefersSingles] = useState(true);
  const [prefersDoubles, setPrefersDoubles] = useState(false);
  const [defaultFormat, setDefaultFormat] = useState<"singles" | "doubles">(
    "singles",
  );
  const [selectedBands, setSelectedBands] = useState<SkillBand[]>([]);
  const [listOnDiscover, setListOnDiscover] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [formatError, setFormatError] = useState(false);
  const [defaultsHydrated, setDefaultsHydrated] = useState(false);
  const pendingSaveRef = useRef<Parameters<
    typeof updateMatchHostDefaults
  >[1] | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjusting state during render rather than in an effect: React sanctions
  // this for prop/query-derived state, and the effect version paints the
  // placeholder defaults for one frame before correcting them.
  if (profile && !defaultsHydrated) {
    const seeded = stateFromProfile(profile, resolved);
    setPlayIntent(seeded.playIntent);
    setPrefersSingles(seeded.prefersSingles);
    setPrefersDoubles(seeded.prefersDoubles);
    setDefaultFormat(seeded.defaultFormat);
    setSelectedBands(seeded.selectedBands);
    setListOnDiscover(seeded.listOnDiscover);
    setRequiresApproval(seeded.requiresApproval);
    setDefaultsHydrated(true);
  }

  const levelOptions = useMemo(
    () =>
      ORDERED_SKILL_BANDS.map((band) => ({
        value: band,
        label: t(`skillBands.${band}`),
      })),
    [t],
  );

  const saveMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateMatchHostDefaults>[1]) =>
      updateMatchHostDefaults(supabase, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["own-player-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
      ]);
    },
  });

  function buildSaveInput(state: DefaultsState) {
    if (!state.prefersSingles && !state.prefersDoubles) {
      setFormatError(true);
      return null;
    }
    if (state.selectedBands.length === 0) {
      return null;
    }

    setFormatError(false);
    const { minSkill, maxSkill } = skillRangeFromSelection(state.selectedBands);

    return {
      playIntent: state.playIntent,
      prefersSingles: state.prefersSingles,
      prefersDoubles: state.prefersDoubles,
      listOnDiscover: state.listOnDiscover,
      defaultRequiresCreatorApproval: state.listOnDiscover
        ? state.requiresApproval
        : false,
      defaultMinSkill: minSkill,
      defaultMaxSkill: maxSkill,
      defaultMatchFormat:
        state.prefersSingles && state.prefersDoubles
          ? state.defaultFormat
          : undefined,
    };
  }

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!pending) {
      return;
    }

    saveMutation.mutate(pending);
  }, [saveMutation]);

  // Leaving the screen must not drop an in-flight edit. Blur fires while the
  // screen is still mounted, so the pending save still goes out.
  useFocusEffect(
    useCallback(() => {
      return () => flushPendingSave();
    }, [flushPendingSave]),
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  function persist(state: DefaultsState) {
    // Nothing to save until the profile has seeded the controls; saving the
    // placeholder state would overwrite real defaults with the initial guess.
    if (!defaultsHydrated) {
      return;
    }
    const input = buildSaveInput(state);
    if (!input) {
      return;
    }

    pendingSaveRef.current = input;
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(flushPendingSave, SAVE_DEBOUNCE_MS);
  }

  function updateState(patch: Partial<DefaultsState>) {
    const next: DefaultsState = {
      playIntent,
      prefersSingles,
      prefersDoubles,
      defaultFormat,
      selectedBands,
      listOnDiscover,
      requiresApproval,
      ...patch,
    };
    if (patch.playIntent !== undefined) setPlayIntent(patch.playIntent);
    if (patch.prefersSingles !== undefined) setPrefersSingles(patch.prefersSingles);
    if (patch.prefersDoubles !== undefined) setPrefersDoubles(patch.prefersDoubles);
    if (patch.defaultFormat !== undefined) setDefaultFormat(patch.defaultFormat);
    if (patch.selectedBands !== undefined) setSelectedBands(patch.selectedBands);
    if (patch.listOnDiscover !== undefined) setListOnDiscover(patch.listOnDiscover);
    if (patch.requiresApproval !== undefined) setRequiresApproval(patch.requiresApproval);
    persist(next);
  }

  const bothFormats = prefersSingles && prefersDoubles;

  return (
    <OnboardingStepLayout
      title={t("profile.matchDefaults.title")}
      description={t("profile.matchDefaults.descriptionAutoSave")}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {profileQuery.isError ? (
          <ErrorNotice>{t("profile.matchDefaults.loadError")}</ErrorNotice>
        ) : null}

        {saveMutation.isPending ? (
          <View style={styles.savingRow}>
            <ActivityIndicator color={tennisColors.primary} size="small" />
            <AppText style={styles.savingLabel}>
              {t("profile.matchDefaults.saving")}
            </AppText>
          </View>
        ) : null}

        <View style={figmaFormStyles.stack}>
          <CreateMatchPanel title={t("profile.matchDefaults.playIntentSection")}>
            <View style={styles.chips}>
              {intents.map((intent) => (
                <ChipButton
                  key={intent}
                  label={t(`playIntent.${intent}`)}
                  selected={playIntent === intent}
                  onPress={() => updateState({ playIntent: intent })}
                />
              ))}
            </View>
          </CreateMatchPanel>

          <CreateMatchPanel title={t("profile.matchDefaults.formatSection")}>
            <View style={styles.chips}>
              <ChipButton
                label={t("formats.singles")}
                selected={prefersSingles}
                onPress={() =>
                  updateState({ prefersSingles: !prefersSingles })
                }
              />
              <ChipButton
                label={t("formats.doubles")}
                selected={prefersDoubles}
                onPress={() =>
                  updateState({ prefersDoubles: !prefersDoubles })
                }
              />
            </View>
            {formatError ? (
              <ErrorNotice>{t("onboarding.tennis.formatError")}</ErrorNotice>
            ) : null}
          </CreateMatchPanel>

          {bothFormats ? (
            <CreateMatchPanel
              title={t("profile.matchDefaults.defaultFormatSection")}
            >
              <View style={styles.chips}>
                <ChipButton
                  label={t("formats.singles")}
                  selected={defaultFormat === "singles"}
                  onPress={() => updateState({ defaultFormat: "singles" })}
                />
                <ChipButton
                  label={t("formats.doubles")}
                  selected={defaultFormat === "doubles"}
                  onPress={() => updateState({ defaultFormat: "doubles" })}
                />
              </View>
            </CreateMatchPanel>
          ) : null}

          <CreateMatchPanel title={t("profile.matchDefaults.levelSection")}>
            <LevelRangePicker
              bands={levelOptions}
              selected={selectedBands}
              onToggle={(band) =>
                updateState({
                  selectedBands: toggleSkillBandSelection(selectedBands, band),
                })
              }
              yourLevel={profile?.skill_band as SkillBand | undefined}
              yourLevelLabel={t("matches.create.yourLevel")}
            />
          </CreateMatchPanel>

          <CreateMatchPanel title={t("profile.matchDefaults.joinSection")}>
            <SettingToggle
              variant="card"
              label={t("matches.create.listOnDiscover")}
              value={listOnDiscover}
              onValueChange={(value) => {
                updateState({
                  listOnDiscover: value,
                  requiresApproval: value ? requiresApproval : false,
                });
              }}
            />
            <AnimatedCollapse visible={listOnDiscover}>
              <SettingToggle
                variant="card"
                label={t("matches.create.requiresApprovalShort")}
                value={requiresApproval}
                onValueChange={(value) => updateState({ requiresApproval: value })}
              />
            </AnimatedCollapse>
          </CreateMatchPanel>
        </View>

        {saveMutation.isError ? (
          <ErrorNotice>{t("profile.matchDefaults.saveError")}</ErrorNotice>
        ) : null}
      </ScrollView>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  savingLabel: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
