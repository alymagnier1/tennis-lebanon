import { useEffect, useMemo } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getActiveZones } from "@tennis-lebanon/api";
import type { Json } from "@tennis-lebanon/types";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  OnboardingStepLayout,
  SelectionCard,
} from "../../src/components/onboarding-ui";
import { autoSelectedZoneIds } from "../../src/lib/onboarding-zone-autoselect";
import { joinOnboardingAreaNames } from "../../src/lib/onboarding-commitment";
import { submitOnboardingDraft } from "../../src/lib/submit-onboarding";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { useOnboarding } from "../../src/providers/OnboardingProvider";
import { tennisTextStyles } from "../../src/theme/tennis-text-styles";

function zoneName(names: Json, locale: string): string {
  if (names && typeof names === "object" && !Array.isArray(names)) {
    const localized = names[locale];
    const english = names.en;
    if (typeof localized === "string") return localized;
    if (typeof english === "string") return english;
  }
  return "";
}

export default function ZonesScreen() {
  const { t, i18n } = useTranslation();
  const { draft, updateDraft, clearDraft } = useOnboarding();
  const { refreshProfile } = useAuth();
  const query = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const zones = query.data;
  const locale = i18n.resolvedLanguage ?? "en";

  useEffect(() => {
    if (!zones) return;
    const next = autoSelectedZoneIds({
      availableZoneIds: zones.map((zone) => zone.id),
      selectedZoneIds: draft.zoneIds,
    });
    if (next) {
      updateDraft({ zoneIds: next });
    }
  }, [zones, draft.zoneIds, updateDraft]);

  const mutation = useMutation({
    mutationFn: () => submitOnboardingDraft(draft),
    onSuccess: async () => {
      await clearDraft();
      await refreshProfile();
      router.replace("/(onboarding)/complete");
    },
  });

  const toggle = (zoneId: string) => {
    const zoneIds = draft.zoneIds.includes(zoneId)
      ? draft.zoneIds.filter((id) => id !== zoneId)
      : [...draft.zoneIds, zoneId];
    updateDraft({ zoneIds });
  };

  const selectedAreaLabel = useMemo(() => {
    if (!zones) return "";
    return joinOnboardingAreaNames(
      draft.zoneIds.flatMap((id) => {
        const zone = zones.find((entry) => entry.id === id);
        if (!zone) return [];
        const name = zoneName(zone.name_i18n, locale);
        return name ? [name] : [];
      }),
    );
  }, [draft.zoneIds, locale, zones]);

  const commitmentEcho =
    draft.skillBand && selectedAreaLabel
      ? t("onboarding.zones.commitmentEcho", {
          band: t(`skillBands.${draft.skillBand}`),
          areas: selectedAreaLabel,
        })
      : null;

  return (
    <OnboardingStepLayout
      title={t("onboarding.zones.title")}
      description={t("onboarding.zones.description")}
      step={3}
      totalSteps={3}
      onBack={() => router.back()}
      footer={
        <FigmaPrimaryButton
          label={t("onboarding.review.finish")}
          disabled={draft.zoneIds.length === 0}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      }
    >
      {query.isLoading ? <ActivityIndicator /> : null}
      {query.isError ? (
        <>
          <ErrorNotice>{t("onboarding.zones.loadError")}</ErrorNotice>
          <FigmaSecondaryButton
            label={t("common.retry")}
            onPress={() => void query.refetch()}
          />
        </>
      ) : null}
      {zones?.length === 0 ? (
        <ErrorNotice>{t("onboarding.zones.empty")}</ErrorNotice>
      ) : null}
      {zones?.map((zone) => (
        <SelectionCard
          key={zone.id}
          label={zoneName(zone.name_i18n, locale)}
          selected={draft.zoneIds.includes(zone.id)}
          onPress={() => toggle(zone.id)}
        />
      ))}
      {commitmentEcho ? (
        <AppText style={tennisTextStyles.fieldHint}>{commitmentEcho}</AppText>
      ) : null}
      {mutation.isError ? (
        <ErrorNotice>{t("onboarding.review.error")}</ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}
