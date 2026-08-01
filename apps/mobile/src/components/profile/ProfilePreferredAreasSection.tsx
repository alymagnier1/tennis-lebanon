import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getActiveZones,
  listOwnPreferredZoneIds,
  updatePreferredZones,
} from "@tennis-lebanon/api";
import { updatePreferredZonesSchema } from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { ChipButton } from "../onboarding-ui";
import { PlayerProfileSection } from "../player/PlayerProfileSection";
import {
  profileScreenPreferredAreasTitle,
  profileScreenZonesError,
} from "../../lib/profile-screen-copy";
import { useLayoutDirection } from "../../lib/layout-direction";
import { supabase } from "../../lib/supabase";
import { zoneNameFromJson } from "../../lib/zones";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function ProfilePreferredAreasSection() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { rowDirection } = useLayoutDirection();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneError, setZoneError] = useState(false);

  const zonesQuery = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const ownZonesQuery = useQuery({
    queryKey: ["own-zone-ids"],
    queryFn: () => listOwnPreferredZoneIds(supabase),
  });

  const [syncedZones, setSyncedZones] = useState<string[] | undefined>(
    undefined,
  );

  // Seed the selection from the server once the query resolves, and re-seed if
  // it changes. Adjusted during render rather than in an effect.
  if (ownZonesQuery.data && ownZonesQuery.data !== syncedZones) {
    setSyncedZones(ownZonesQuery.data);
    setSelectedZoneIds(ownZonesQuery.data);
  }

  const saveMutation = useMutation({
    mutationFn: async (zoneIds: string[]) => {
      const parsed = updatePreferredZonesSchema.safeParse({ zoneIds });
      if (!parsed.success) {
        setZoneError(true);
        throw new Error("Invalid preferred zones");
      }

      setZoneError(false);
      await updatePreferredZones(supabase, parsed.data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["own-zone-ids"] }),
        queryClient.invalidateQueries({ queryKey: ["own-zones"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-matches"] }),
      ]);
    },
  });

  const toggleZone = (zoneId: string) => {
    const next = selectedZoneIds.includes(zoneId)
      ? selectedZoneIds.filter((id) => id !== zoneId)
      : [...selectedZoneIds, zoneId];

    if (next.length === 0) {
      setZoneError(true);
      return;
    }

    setSelectedZoneIds(next);
    saveMutation.mutate(next);
  };

  const isLoading = zonesQuery.isLoading || ownZonesQuery.isLoading;

  return (
    <PlayerProfileSection title={profileScreenPreferredAreasTitle(t)}>
      {isLoading ? <ActivityIndicator color={tennisColors.primary} /> : null}
      {zonesQuery.isError || ownZonesQuery.isError ? (
        <AppText style={styles.error}>
          {t("onboarding.zones.loadError")}
        </AppText>
      ) : null}
      {!isLoading && zonesQuery.data?.length === 0 ? (
        <AppText style={styles.muted}>{t("onboarding.zones.empty")}</AppText>
      ) : null}
      <View style={[styles.chips, { flexDirection: rowDirection }]}>
        {zonesQuery.data?.map((zone) => (
          <ChipButton
            key={zone.id}
            label={zoneNameFromJson(zone.name_i18n, locale)}
            selected={selectedZoneIds.includes(zone.id)}
            onPress={() => toggleZone(zone.id)}
          />
        ))}
      </View>
      {zoneError ? (
        <AppText style={styles.error}>{profileScreenZonesError(t)}</AppText>
      ) : null}
    </PlayerProfileSection>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexWrap: "wrap",
    gap: 8,
  },
  muted: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  error: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.accent,
  },
});
