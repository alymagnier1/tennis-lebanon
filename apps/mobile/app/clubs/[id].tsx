import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { canBookClubInApp, formatPriceMinor } from "@tennis-lebanon/domain";
import {
  confirmExternalCourt,
  getClubDetail,
  getClubWhatsAppBookingLink,
  getMatchHub,
  requestMatchBooking,
  setClubFavorite,
} from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { AppText } from "../../src/components/AppText";
import { SectionTitle } from "../../src/components/AppUi";
import {
  Choice,
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";
import type { Json } from "@tennis-lebanon/types";
import { formatUtcSlotInBeirut } from "../../src/lib/beirut-time";
import { clubBookingModeLabelKey } from "../../src/lib/club-booking-label";
import { matchHubRoute } from "../../src/lib/routes";
import { supabase } from "../../src/lib/supabase";
import { openWhatsAppBooking } from "../../src/lib/whatsapp-booking";
import { zoneNameFromJson } from "../../src/lib/zones";

export default function ClubDetailScreen() {
  const { id, matchId } = useLocalSearchParams<{
    id: string;
    matchId?: string;
  }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [courtId, setCourtId] = useState<string | null>(null);
  const isMatchBooking = Boolean(matchId);

  const clubQuery = useQuery({
    queryKey: ["club-detail", id],
    queryFn: () => getClubDetail(supabase, id!),
    enabled: Boolean(id),
  });

  const hubQuery = useQuery({
    queryKey: ["match-hub", matchId],
    queryFn: () => getMatchHub(supabase, matchId!),
    enabled: Boolean(matchId),
  });

  const agreedSlot = useMemo(() => {
    const selected = hubQuery.data?.selected_time_option_id;
    if (!selected) return null;
    return (
      hubQuery.data?.proposed_times.find((slot) => slot.id === selected) ?? null
    );
  }, [hubQuery.data]);

  const favoriteMutation = useMutation({
    mutationFn: (favorite: boolean) => setClubFavorite(supabase, id!, favorite),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["clubs-directory"] });
    },
    onError: () => Alert.alert(t("clubs.favoriteError")),
  });

  const whatsappMutation = useMutation({
    mutationFn: () =>
      getClubWhatsAppBookingLink(supabase, id!, matchId ?? undefined),
    onSuccess: async (link) => {
      try {
        await openWhatsAppBooking(link);
      } catch {
        Alert.alert(t("clubs.whatsappError"));
      }
    },
    onError: () => Alert.alert(t("clubs.whatsappError")),
  });

  const requestMutation = useMutation({
    mutationFn: () => requestMatchBooking(supabase, matchId!, courtId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", matchId] });
      await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      Alert.alert(t("matches.booking.submitSuccess"));
      router.replace(matchHubRoute(matchId!));
    },
    onError: () => Alert.alert(t("matches.booking.submitError")),
  });

  // Many hosts will simply phone the club, especially where booking happens on
  // WhatsApp. Recording that keeps the match moving instead of stranding it at
  // ready_to_book while it is actually played.
  const confirmExternalMutation = useMutation({
    mutationFn: () =>
      confirmExternalCourt(supabase, {
        matchId: matchId!,
        courtId: courtId!,
        startsAt: agreedSlot!.starts_at,
        endsAt: agreedSlot!.ends_at,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", matchId] });
      await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      Alert.alert(t("matches.booking.externalSuccess"));
      router.replace(matchHubRoute(matchId!));
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      Alert.alert(
        message.includes("court_already_booked")
          ? t("matches.booking.courtAlreadyBooked")
          : t("matches.booking.externalError"),
      );
    },
  });

  const club = clubQuery.data;
  const supportsInAppBooking = club
    ? canBookClubInApp(club.booking_mode)
    : false;

  return (
    <Screen
      title={club?.name ?? t("clubs.detailTitle")}
      showTitle={Boolean(club?.name)}
      refreshing={clubQuery.isRefetching}
      onRefresh={() => void clubQuery.refetch()}
    >
      {clubQuery.isLoading ? (
        <ActivityIndicator accessibilityLabel={t("discover.loading")} />
      ) : null}

      {clubQuery.isError ? (
        <AppText style={formStyles.errorText}>{t("clubs.loadError")}</AppText>
      ) : null}

      {club ? (
        <>
          <AppText style={styles.description}>
            {club.description ??
              zoneNameFromJson(
                club.zone_name_i18n as Json,
                i18n.resolvedLanguage ?? i18n.language,
              )}
          </AppText>
          {club.address_public ? (
            <AppText style={styles.meta}>{club.address_public}</AppText>
          ) : null}
          <AppText style={styles.badge}>
            {t(clubBookingModeLabelKey(club.booking_mode))} ·{" "}
            {t("clubs.payAtClub")}
          </AppText>

          {isMatchBooking ? (
            <View style={formStyles.compactCard}>
              <AppText style={formStyles.compactCardTitle}>
                {t("clubs.bookForMatch")}
              </AppText>
              {hubQuery.isLoading ? <ActivityIndicator /> : null}
              {agreedSlot ? (
                <AppText style={styles.meta}>
                  {formatUtcSlotInBeirut(
                    agreedSlot.starts_at,
                    agreedSlot.ends_at,
                  )}
                </AppText>
              ) : (
                <AppText style={styles.meta}>
                  {t("matches.booking.confirmTime")}
                </AppText>
              )}

              {club.whatsapp_booking_available ? (
                <PrimaryButton
                  label={t("clubs.bookWhatsApp")}
                  disabled={!agreedSlot}
                  loading={whatsappMutation.isPending}
                  onPress={() => whatsappMutation.mutate()}
                />
              ) : null}

              {club.courts.length > 0 ? (
                <>
                  <AppText style={formStyles.summaryLabel}>
                    {t("clubs.selectCourtForMatch")}
                  </AppText>
                  <View style={formStyles.stack}>
                    {club.courts.map((court) => {
                      const price = formatPriceMinor(
                        court.price_minor,
                        court.currency,
                      );
                      return (
                        <Choice
                          key={court.court_id}
                          label={court.name}
                          description={[
                            t(`clubs.surfaces.${court.surface}`),
                            court.is_indoor
                              ? t("clubs.indoor")
                              : t("clubs.outdoor"),
                            price,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          selected={courtId === court.court_id}
                          onPress={() => setCourtId(court.court_id)}
                        />
                      );
                    })}
                  </View>
                  {/* WhatsApp already leads above the court list, before the
                      court matters: you message the club to ask, and pick the
                      court they gave you afterwards. Repeating it here put the
                      same button on screen twice. */}
                  {supportsInAppBooking ? (
                    <PrimaryButton
                      label={t("clubs.requestCourt")}
                      disabled={!courtId || !agreedSlot}
                      loading={requestMutation.isPending}
                      onPress={() => requestMutation.mutate()}
                    />
                  ) : null}

                  {/* Works for either club mode: the host may have called
                      rather than waited on the in-app queue. */}
                  <SecondaryButton
                    label={t("clubs.confirmExternalCourt")}
                    disabled={!courtId || !agreedSlot}
                    loading={confirmExternalMutation.isPending}
                    onPress={() => confirmExternalMutation.mutate()}
                  />
                  <AppText style={formStyles.description}>
                    {t("clubs.confirmExternalCourtHelp")}
                  </AppText>
                </>
              ) : null}
            </View>
          ) : (
            <>
              {club.whatsapp_booking_available ? (
                <PrimaryButton
                  label={t("clubs.bookWhatsApp")}
                  loading={whatsappMutation.isPending}
                  onPress={() => whatsappMutation.mutate()}
                />
              ) : null}
            </>
          )}

          {club.is_favorite ? (
            <SecondaryButton
              label={t("clubs.unfavorite")}
              loading={favoriteMutation.isPending}
              onPress={() => favoriteMutation.mutate(false)}
            />
          ) : (
            <SecondaryButton
              label={t("clubs.favorite")}
              loading={favoriteMutation.isPending}
              onPress={() => favoriteMutation.mutate(true)}
            />
          )}

          {!(isMatchBooking && supportsInAppBooking) ? (
            <>
              <SectionTitle title={t("clubs.courts")} />
              <View style={formStyles.stack}>
                {club.courts.map((court) => {
                  const price = formatPriceMinor(
                    court.price_minor,
                    court.currency,
                  );
                  return (
                    <View key={court.court_id} style={styles.courtCard}>
                      <AppText style={styles.courtName}>{court.name}</AppText>
                      <AppText style={styles.meta}>
                        {t(`clubs.surfaces.${court.surface}`)} ·{" "}
                        {court.is_indoor
                          ? t("clubs.indoor")
                          : t("clubs.outdoor")}
                        {price ? ` · ${price}` : ""}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {club.amenities.length > 0 ? (
            <>
              <SectionTitle title={t("clubs.amenities")} />
              <AppText style={styles.meta}>
                {club.amenities.join(" · ")}
              </AppText>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: {
    color: colors.neutral[700],
    fontSize: typography.size.md,
    lineHeight: 22,
  },
  meta: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
  },
  badge: {
    color: colors.brand[700],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  courtCard: {
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  courtName: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
