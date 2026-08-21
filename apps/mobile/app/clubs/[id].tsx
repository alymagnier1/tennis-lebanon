import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  canBookClubInApp,
  canConfirmExternalCourt,
  canRequestCourt,
} from "@tennis-lebanon/domain";
import {
  confirmExternalCourt,
  getClubDetail,
  getClubWhatsAppBookingLink,
  getMatchHub,
  requestMatchBooking,
  setClubFavorite,
} from "@tennis-lebanon/api";
import type { Json } from "@tennis-lebanon/types";
import { AppText } from "../../src/components/AppText";
import { Icon } from "../../src/components/Icon";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaBackButton,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../src/components/onboarding-ui";
import { formatUtcSlotInBeirut } from "../../src/lib/beirut-time";
import { clubBookingModeLabelKey } from "../../src/lib/club-booking-label";
import { confirmAction, notify } from "../../src/lib/confirm-action";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { exitClubDetail } from "../../src/lib/navigation";
import { preferredClubLocationLabel } from "../../src/lib/match-clubs";
import { matchHubRoute } from "../../src/lib/routes";
import { stackScreenTopPadding } from "../../src/lib/stack-screen-padding";
import { supabase } from "../../src/lib/supabase";
import { openWhatsAppBooking } from "../../src/lib/whatsapp-booking";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import {
  tennisBrand,
  tennisColors,
  tennisRadii,
  tennisSemantic,
  tennisSpacing,
} from "../../src/theme/tennis-tokens";
import { tennisTextStyles } from "../../src/theme/tennis-text-styles";

const PHOTO_PLACEHOLDER = "#E09A5C";

/**
 * Club detail: image + essentials, then one booking path when opened from a match.
 *
 * v1 does not ask the host to pick a court on this screen — the first court on
 * the club stands in so Message / Request / Confirm stay one tap.
 */
export default function ClubDetailScreen() {
  const { id, matchId } = useLocalSearchParams<{
    id: string;
    matchId?: string;
  }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const isMatchBooking = Boolean(matchId);
  const topPadding = stackScreenTopPadding(insets.top);

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

  const hub = hubQuery.data;
  const canHostBookForMatch =
    Boolean(matchId) &&
    hub != null &&
    (canRequestCourt({
      viewerIsCreator: hub.viewer_is_creator,
      matchStatus: hub.status,
      nextAction: hub.next_action,
    }) ||
      canConfirmExternalCourt({
        viewerIsParticipant: hub.viewer_status === "accepted",
        viewerIsCreator: hub.viewer_is_creator,
        matchStatus: hub.status,
        timingMode: hub.timing_mode,
        hasAgreedTime: Boolean(hub.selected_time_option_id),
        hasAcceptedBooking: hub.booking?.status === "accepted",
      }));

  const showMatchBooking = isMatchBooking && canHostBookForMatch;

  const favoriteMutation = useMutation({
    mutationFn: (favorite: boolean) => setClubFavorite(supabase, id!, favorite),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["clubs-directory"] });
    },
    onError: () => notify(t("clubs.favoriteError")),
  });

  const whatsappMutation = useMutation({
    mutationFn: () =>
      getClubWhatsAppBookingLink(
        supabase,
        id!,
        showMatchBooking ? matchId : undefined,
      ),
    onSuccess: async (link) => {
      try {
        await openWhatsAppBooking(link);
      } catch {
        notify(t("clubs.whatsappError"));
      }
    },
    onError: () => notify(t("clubs.whatsappError")),
  });

  const requestMutation = useMutation({
    mutationFn: (courtId: string) =>
      requestMatchBooking(supabase, matchId!, courtId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", matchId] });
      await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      notify(t("matches.booking.submitSuccess"));
      router.replace(matchHubRoute(matchId!));
    },
    onError: () => notify(t("matches.booking.submitError")),
  });

  const confirmExternalMutation = useMutation({
    mutationFn: (courtId: string) =>
      confirmExternalCourt(supabase, {
        matchId: matchId!,
        courtId,
        startsAt: agreedSlot!.starts_at,
        endsAt: agreedSlot!.ends_at,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", matchId] });
      await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      notify(t("matches.booking.externalSuccess"));
      router.replace(matchHubRoute(matchId!));
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      notify(
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
  const defaultCourt = club?.courts[0] ?? null;
  const location = club
    ? preferredClubLocationLabel({
        addressPublic: club.address_public,
        zoneNameI18n: (club.zone_name_i18n ?? null) as Json,
        locale,
      })
    : null;

  const surfaceSummary = useMemo(() => {
    if (!club?.courts.length) return null;
    const surfaces = [
      ...new Set(club.courts.map((court) => court.surface)),
    ].map((surface) => t(`clubs.surfaces.${surface}`));
    return [
      t("clubs.courtCount", { count: club.courts.length }),
      ...surfaces.slice(0, 2),
    ].join(" · ");
  }, [club, t]);

  function handleConfirmExternal() {
    if (!defaultCourt || !agreedSlot || !club) return;
    confirmAction({
      title: t("matches.booking.bookedOffAppConfirmTitle"),
      message: t("matches.booking.bookedOffAppConfirmBody", {
        club: club.name,
        court: defaultCourt.name,
        time: formatUtcSlotInBeirut(agreedSlot.starts_at, agreedSlot.ends_at),
      }),
      confirmLabel: t("matches.booking.bookedOffAppConfirm"),
      cancelLabel: t("common.cancel"),
      onConfirm: () => confirmExternalMutation.mutate(defaultCourt.court_id),
    });
  }

  const title = club?.name ?? t("clubs.detailTitle");

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { paddingTop: topPadding, paddingHorizontal: tennisSpacing.screenX },
        ]}
      >
        <FigmaBackButton onPress={exitClubDetail} />
        <View style={tennisTextStyles.titleSubtitleBlock}>
          <AppText
            accessibilityRole="header"
            style={[styles.title, { writingDirection }]}
            maxLines={2}
          >
            {title}
          </AppText>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: tennisSpacing.screenX,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={clubQuery.isRefetching}
            onRefresh={() => void clubQuery.refetch()}
          />
        }
      >
        {clubQuery.isLoading ? (
          <ActivityIndicator accessibilityLabel={t("common.loading")} />
        ) : null}

        {clubQuery.isError ? (
          <ErrorNotice>{t("clubs.loadError")}</ErrorNotice>
        ) : null}

        {club ? (
          <View style={styles.body}>
            <View style={styles.hero}>
              <Icon name="place" size={40} color={tennisColors.white} />
            </View>

            <View style={styles.details}>
              {location ? (
                <AppText
                  style={[
                    tennisTextStyles.sectionSubtitle,
                    { writingDirection },
                  ]}
                  maxLines={2}
                >
                  {location}
                </AppText>
              ) : null}

              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badge,
                    club.whatsapp_booking_available
                      ? styles.badgeWhatsApp
                      : styles.badgeDefault,
                  ]}
                >
                  <AppText
                    style={[
                      styles.badgeText,
                      club.whatsapp_booking_available
                        ? styles.badgeTextWhatsApp
                        : styles.badgeTextDefault,
                    ]}
                  >
                    {t(clubBookingModeLabelKey(club.booking_mode))}
                  </AppText>
                </View>
                <AppText style={styles.payHint}>{t("clubs.payAtClub")}</AppText>
              </View>

              {surfaceSummary ? (
                <AppText
                  style={[styles.metaLine, { writingDirection }]}
                  maxLines={1}
                >
                  {surfaceSummary}
                </AppText>
              ) : null}

              {club.description ? (
                <AppText
                  style={[styles.description, { writingDirection }]}
                  maxLines={2}
                >
                  {club.description}
                </AppText>
              ) : null}
            </View>

            {showMatchBooking ? (
              <View style={styles.bookingCard}>
                <AppText style={styles.bookingTitle}>
                  {t("clubs.bookForMatch")}
                </AppText>
                {hubQuery.isLoading ? (
                  <ActivityIndicator accessibilityLabel={t("common.loading")} />
                ) : agreedSlot ? (
                  <AppText style={[styles.metaLine, { writingDirection }]}>
                    {formatUtcSlotInBeirut(
                      agreedSlot.starts_at,
                      agreedSlot.ends_at,
                    )}
                  </AppText>
                ) : (
                  <AppText style={[styles.metaLine, { writingDirection }]}>
                    {t("matches.booking.confirmTime")}
                  </AppText>
                )}

                {club.whatsapp_booking_available ? (
                  <FigmaPrimaryButton
                    label={t("clubs.bookWhatsApp")}
                    disabled={!agreedSlot}
                    loading={whatsappMutation.isPending}
                    onPress={() => whatsappMutation.mutate()}
                  />
                ) : null}

                {supportsInAppBooking ? (
                  <FigmaPrimaryButton
                    label={t("clubs.requestCourt")}
                    disabled={!defaultCourt || !agreedSlot}
                    loading={requestMutation.isPending}
                    onPress={() => {
                      if (!defaultCourt) return;
                      requestMutation.mutate(defaultCourt.court_id);
                    }}
                  />
                ) : null}

                <FigmaSecondaryButton
                  label={t("matches.booking.bookedOffAppConfirm")}
                  disabled={
                    !defaultCourt ||
                    !agreedSlot ||
                    confirmExternalMutation.isPending
                  }
                  onPress={handleConfirmExternal}
                />
              </View>
            ) : club.whatsapp_booking_available ? (
              <FigmaPrimaryButton
                label={t("clubs.bookWhatsApp")}
                loading={whatsappMutation.isPending}
                onPress={() => whatsappMutation.mutate()}
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                club.is_favorite ? t("clubs.unfavorite") : t("clubs.favorite")
              }
              disabled={favoriteMutation.isPending}
              onPress={() => favoriteMutation.mutate(!club.is_favorite)}
              style={({ pressed }) => [
                styles.favoriteRow,
                pressed && styles.pressed,
              ]}
            >
              <AppText style={styles.favoriteLabel}>
                {favoriteMutation.isPending
                  ? t("common.loading")
                  : club.is_favorite
                    ? t("clubs.unfavorite")
                    : t("clubs.favorite")}
              </AppText>
            </Pressable>

            {club.amenities.length > 0 ? (
              <View style={styles.amenities}>
                <AppText style={styles.amenitiesLabel}>
                  {t("clubs.amenities")}
                </AppText>
                <View style={styles.chipRow}>
                  {club.amenities.map((amenity) => (
                    <View key={amenity} style={styles.chip}>
                      <AppText style={styles.chipText}>{amenity}</AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  header: {
    gap: 12,
    paddingBottom: 8,
  },
  title: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 24,
    lineHeight: 30,
    color: tennisColors.primaryDark,
    letterSpacing: -0.4,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 16,
    paddingTop: 8,
  },
  body: {
    gap: 16,
  },
  hero: {
    height: 160,
    borderRadius: tennisRadii.lg,
    backgroundColor: PHOTO_PLACEHOLDER,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  details: {
    gap: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  badge: {
    borderRadius: tennisRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeWhatsApp: {
    backgroundColor: tennisBrand.whatsappFill,
  },
  badgeDefault: {
    backgroundColor: tennisSemantic.attention.fill,
  },
  badgeText: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 11,
  },
  badgeTextWhatsApp: {
    color: tennisBrand.whatsappText,
  },
  badgeTextDefault: {
    color: tennisSemantic.attention.text,
  },
  payHint: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
  metaLine: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: tennisColors.mutedForeground,
  },
  description: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: tennisColors.mutedForeground,
    marginTop: 2,
  },
  bookingCard: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.lg,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    padding: 16,
    gap: 12,
  },
  bookingTitle: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 17,
    lineHeight: 22,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  favoriteLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primary,
  },
  amenities: {
    gap: 8,
  },
  amenitiesLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: tennisColors.muted,
    borderRadius: tennisRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.primaryDark,
  },
  pressed: {
    opacity: 0.85,
  },
});
