import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import {
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
import { ScreenError } from "../../src/components/FormUi";
import {
  FigmaBackButton,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../src/components/onboarding-ui";
import { formatUtcSlotInBeirut } from "../../src/lib/beirut-time";
import { clubBookingModeLabelKey } from "../../src/lib/club-booking-label";
import {
  clubAmenityI18nKey,
  clubBrowsePrimaryAction,
  clubFactChips,
  clubMatchPrimaryAction,
  humanizeClubAmenity,
  isKnownClubSurface,
  type ClubFactChip,
  type ClubPrimaryAction,
} from "../../src/lib/club-detail-layout";
import { confirmAction, notify } from "../../src/lib/confirm-action";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { exitClubDetail } from "../../src/lib/navigation";
import { preferredClubLocationLabel } from "../../src/lib/match-clubs";
import { matchHubRoute } from "../../src/lib/routes";
import { supabase } from "../../src/lib/supabase";
import { openWhatsAppBooking } from "../../src/lib/whatsapp-booking";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import {
  tennisBrand,
  tennisColors,
  tennisHeroArt,
  tennisRadii,
  tennisSemantic,
  tennisSpacing,
} from "../../src/theme/tennis-tokens";

/**
 * Club detail: decide if this is tonight's court, then take one booking path.
 *
 * v1 does not ask the host to pick a court — the first court stands in so
 * Message / Request / Confirm stay one tap.
 */
export default function ClubDetailScreen() {
  const { id, matchId } = useLocalSearchParams<{
    id: string;
    matchId?: string;
  }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { writingDirection, isRtl } = useLayoutDirection();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
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
  const defaultCourt = club?.courts[0] ?? null;
  const location = club
    ? preferredClubLocationLabel({
        addressPublic: club.address_public,
        zoneNameI18n: (club.zone_name_i18n ?? null) as Json,
        locale,
      })
    : null;

  const facts = useMemo(() => (club ? clubFactChips(club.courts) : []), [club]);

  const primaryAction: ClubPrimaryAction = club
    ? showMatchBooking
      ? clubMatchPrimaryAction(club)
      : clubBrowsePrimaryAction(club.whatsapp_booking_available)
    : "none";

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

  function amenityLabel(amenity: string): string {
    const key = clubAmenityI18nKey(amenity);
    return key ? t(key) : humanizeClubAmenity(amenity);
  }

  function factLabel(chip: ClubFactChip): string {
    switch (chip.kind) {
      case "courts":
        return t("clubs.courtCount", { count: chip.count });
      case "surface":
        return isKnownClubSurface(chip.surface)
          ? t(`clubs.surfaces.${chip.surface}`)
          : chip.surface;
      case "indoor":
        return t("clubs.indoor");
      case "fromPrice":
        return t("clubs.from", { price: chip.priceLabel });
    }
  }

  const showFooter =
    Boolean(club) && (primaryAction !== "none" || showMatchBooking);
  const primaryDisabled =
    showMatchBooking &&
    (!agreedSlot ||
      (primaryAction === "request" && !defaultCourt) ||
      whatsappMutation.isPending ||
      requestMutation.isPending);
  const primaryLoading =
    primaryAction === "whatsapp"
      ? whatsappMutation.isPending
      : primaryAction === "request"
        ? requestMutation.isPending
        : false;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={clubQuery.isRefetching}
            onRefresh={() => void clubQuery.refetch()}
          />
        }
      >
        {clubQuery.isLoading ? (
          <ClubDetailSkeleton
            topInset={insets.top}
            isRtl={isRtl}
            loadingLabel={t("common.loading")}
          />
        ) : null}

        {clubQuery.isError ? (
          <View style={styles.errorBlock}>
            <View
              style={[
                styles.chromeRow,
                {
                  paddingTop: insets.top + 8,
                  flexDirection: isRtl ? "row-reverse" : "row",
                },
              ]}
            >
              <FigmaBackButton onPress={exitClubDetail} />
            </View>
            <View style={styles.errorNotice}>
              <ScreenError
                message={t("clubs.loadError")}
                retryLabel={t("common.retry")}
                onRetry={() => void clubQuery.refetch()}
              />
            </View>
          </View>
        ) : null}

        {!clubQuery.isLoading && !clubQuery.isError && !club ? (
          <View style={styles.errorBlock}>
            <View
              style={[
                styles.chromeRow,
                {
                  paddingTop: insets.top + 8,
                  flexDirection: isRtl ? "row-reverse" : "row",
                },
              ]}
            >
              <FigmaBackButton onPress={exitClubDetail} />
            </View>
            <View style={styles.errorNotice}>
              <ScreenError
                message={t("clubs.notFound")}
                retryLabel={t("common.retry")}
              />
            </View>
          </View>
        ) : null}

        {club ? (
          <View>
            <View style={styles.hero}>
              <View style={styles.heroFill} />
              <View style={styles.heroMark} accessibilityElementsHidden>
                <Icon name="court" size={88} color={tennisColors.white} />
              </View>
              <View style={styles.heroScrim} />
              <View
                style={[
                  styles.heroChrome,
                  { paddingTop: insets.top + 8, paddingBottom: 20 },
                ]}
              >
                <View
                  style={[
                    styles.chromeRow,
                    { flexDirection: isRtl ? "row-reverse" : "row" },
                  ]}
                >
                  <FigmaBackButton onDark onPress={exitClubDetail} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      club.is_favorite
                        ? t("clubs.unfavorite")
                        : t("clubs.favorite")
                    }
                    accessibilityState={{ selected: club.is_favorite }}
                    disabled={favoriteMutation.isPending}
                    onPress={() => favoriteMutation.mutate(!club.is_favorite)}
                    style={({ pressed }) => [
                      styles.favoriteBtn,
                      club.is_favorite && styles.favoriteBtnOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon
                      name={club.is_favorite ? "star" : "starOutline"}
                      size={20}
                      color={
                        club.is_favorite
                          ? tennisColors.limeText
                          : tennisColors.white
                      }
                    />
                  </Pressable>
                </View>

                <View style={styles.heroCopy}>
                  <AppText
                    accessibilityRole="header"
                    style={[styles.heroName, { writingDirection }]}
                    maxLines={2}
                  >
                    {club.name}
                  </AppText>
                  {location ? (
                    <AppText
                      style={[styles.heroLocation, { writingDirection }]}
                      maxLines={2}
                    >
                      {location}
                    </AppText>
                  ) : null}
                  <View
                    style={[
                      styles.badgeRow,
                      { flexDirection: isRtl ? "row-reverse" : "row" },
                    ]}
                  >
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
                  </View>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.body,
                { paddingHorizontal: tennisSpacing.screenX },
              ]}
            >
              {facts.length > 0 ? (
                <View
                  style={[
                    styles.chipRow,
                    { flexDirection: isRtl ? "row-reverse" : "row" },
                  ]}
                >
                  {facts.map((chip) => (
                    <View
                      key={`${chip.kind}-${chip.kind === "surface" ? chip.surface : chip.kind === "courts" ? chip.count : chip.kind === "fromPrice" ? chip.priceLabel : "indoor"}`}
                      style={styles.chip}
                    >
                      <AppText style={styles.chipText}>
                        {factLabel(chip)}
                      </AppText>
                    </View>
                  ))}
                  <View style={styles.chipQuiet}>
                    <AppText style={styles.chipQuietText}>
                      {t("clubs.payAtClub")}
                    </AppText>
                  </View>
                </View>
              ) : (
                <View style={styles.chipQuiet}>
                  <AppText style={styles.chipQuietText}>
                    {t("clubs.payAtClub")}
                  </AppText>
                </View>
              )}

              {club.description ? (
                <AppText style={[styles.description, { writingDirection }]}>
                  {club.description}
                </AppText>
              ) : null}

              {club.amenities.length > 0 ? (
                <View style={styles.amenities}>
                  <AppText style={styles.amenitiesLabel}>
                    {t("clubs.amenities")}
                  </AppText>
                  <View
                    style={[
                      styles.chipRow,
                      { flexDirection: isRtl ? "row-reverse" : "row" },
                    ]}
                  >
                    {club.amenities.map((amenity) => (
                      <View key={amenity} style={styles.chip}>
                        <AppText style={styles.chipText}>
                          {amenityLabel(amenity)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {showFooter ? (
        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: tennisSpacing.screenX,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          {showMatchBooking ? (
            <View style={styles.matchMeta}>
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
            </View>
          ) : null}

          {primaryAction === "whatsapp" ? (
            <FigmaPrimaryButton
              label={t("clubs.bookWhatsApp")}
              disabled={primaryDisabled}
              loading={primaryLoading}
              onPress={() => whatsappMutation.mutate()}
            />
          ) : null}

          {primaryAction === "request" ? (
            <FigmaPrimaryButton
              label={t("clubs.requestCourt")}
              disabled={primaryDisabled}
              loading={primaryLoading}
              onPress={() => {
                if (!defaultCourt) return;
                requestMutation.mutate(defaultCourt.court_id);
              }}
            />
          ) : null}

          {showMatchBooking ? (
            <FigmaSecondaryButton
              label={t("matches.booking.bookedOffAppConfirm")}
              disabled={
                !defaultCourt ||
                !agreedSlot ||
                confirmExternalMutation.isPending
              }
              onPress={handleConfirmExternal}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ClubDetailSkeleton({
  topInset,
  isRtl,
  loadingLabel,
}: {
  topInset: number;
  isRtl: boolean;
  loadingLabel: string;
}) {
  return (
    <View accessibilityLabel={loadingLabel}>
      <View style={styles.hero}>
        <View style={styles.heroFill} />
        <View
          style={[
            styles.heroChrome,
            { paddingTop: topInset + 8, paddingBottom: 20 },
          ]}
        >
          <View
            style={[
              styles.chromeRow,
              { flexDirection: isRtl ? "row-reverse" : "row" },
            ]}
          >
            <FigmaBackButton onDark onPress={exitClubDetail} />
          </View>
        </View>
      </View>
      <View style={[styles.body, { paddingHorizontal: tennisSpacing.screenX }]}>
        <View style={styles.skeletonChipRow}>
          <View style={styles.skeletonChip} />
          <View style={styles.skeletonChip} />
          <View style={styles.skeletonChipWide} />
        </View>
        <View style={styles.skeletonLine} />
        <View style={styles.skeletonLineShort} />
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
    },
    hero: {
      height: 248,
      overflow: "hidden",
      backgroundColor: tennisColors.photoPlaceholder,
    },
    heroFill: {
      ...StyleSheet.absoluteFill,
      backgroundColor: tennisColors.photoPlaceholder,
    },
    heroMark: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.22,
    },
    heroScrim: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 148,
      backgroundColor: tennisHeroArt.heroGreen,
      opacity: 0.78,
    },
    heroChrome: {
      ...StyleSheet.absoluteFill,
      justifyContent: "space-between",
      paddingHorizontal: tennisSpacing.screenX,
    },
    chromeRow: {
      alignItems: "center",
      justifyContent: "space-between",
    },
    favoriteBtn: {
      width: minTouchTargetPx,
      height: minTouchTargetPx,
      borderRadius: minTouchTargetPx / 2,
      backgroundColor: "rgba(13, 28, 20, 0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteBtnOn: {
      backgroundColor: tennisColors.lime,
    },
    heroCopy: {
      gap: 6,
    },
    heroName: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 28,
      lineHeight: 32,
      color: tennisColors.white,
      letterSpacing: -0.5,
    },
    heroLocation: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.white,
      opacity: 0.88,
    },
    badgeRow: {
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
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
    body: {
      gap: 16,
      paddingTop: 20,
      paddingBottom: 28,
    },
    chipRow: {
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      backgroundColor: tennisColors.muted,
      borderRadius: tennisRadii.pill,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      color: tennisColors.primaryDark,
    },
    chipQuiet: {
      backgroundColor: tennisColors.quietFill,
      borderRadius: tennisRadii.pill,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipQuietText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      color: tennisColors.mutedForeground,
    },
    description: {
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      lineHeight: 22,
      color: tennisColors.primaryDark,
    },
    amenities: {
      gap: 10,
    },
    amenitiesLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 12,
      color: tennisColors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      paddingTop: 12,
      gap: 10,
    },
    matchMeta: {
      gap: 4,
      marginBottom: 4,
    },
    bookingTitle: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 16,
      lineHeight: 20,
      color: tennisColors.primaryDark,
      letterSpacing: -0.2,
    },
    metaLine: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    errorBlock: {
      flexGrow: 1,
    },
    errorNotice: {
      paddingHorizontal: tennisSpacing.screenX,
      paddingTop: 12,
    },
    pressed: {
      opacity: 0.85,
    },
    skeletonChipRow: {
      flexDirection: "row",
      gap: 8,
    },
    skeletonChip: {
      width: 72,
      height: 28,
      borderRadius: tennisRadii.pill,
      backgroundColor: tennisColors.muted,
    },
    skeletonChipWide: {
      width: 108,
      height: 28,
      borderRadius: tennisRadii.pill,
      backgroundColor: tennisColors.muted,
    },
    skeletonLine: {
      height: 14,
      borderRadius: 7,
      backgroundColor: tennisColors.muted,
    },
    skeletonLineShort: {
      height: 14,
      width: "62%",
      borderRadius: 7,
      backgroundColor: tennisColors.muted,
    },
  }),
);
