import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getActiveZones } from "@tennis-lebanon/api";
import type { Json } from "@tennis-lebanon/types";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  OnboardingStepLayout,
  SelectionCard,
} from "../../src/components/onboarding-ui";
import { supabase } from "../../src/lib/supabase";
import { useOnboarding } from "../../src/providers/OnboardingProvider";

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
  const { draft, updateDraft } = useOnboarding();
  const query = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const toggle = (zoneId: string) => {
    const zoneIds = draft.zoneIds.includes(zoneId)
      ? draft.zoneIds.filter((id) => id !== zoneId)
      : [...draft.zoneIds, zoneId];
    updateDraft({ zoneIds });
  };

  return (
    <OnboardingStepLayout
      title={t("onboarding.zones.title")}
      description={t("onboarding.zones.description")}
      step={4}
      totalSteps={6}
      onBack={() => router.back()}
      footer={
        <FigmaPrimaryButton
          label={t("common.continue")}
          disabled={draft.zoneIds.length === 0}
          onPress={() => router.push("/(onboarding)/notifications")}
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
      {query.data?.length === 0 ? (
        <ErrorNotice>{t("onboarding.zones.empty")}</ErrorNotice>
      ) : null}
      {query.data?.map((zone) => (
        <SelectionCard
          key={zone.id}
          label={zoneName(zone.name_i18n, i18n.resolvedLanguage ?? "en")}
          selected={draft.zoneIds.includes(zone.id)}
          onPress={() => toggle(zone.id)}
        />
      ))}
    </OnboardingStepLayout>
  );
}
