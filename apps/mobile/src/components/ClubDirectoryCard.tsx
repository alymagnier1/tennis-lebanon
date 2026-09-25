import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import type { ClubDirectoryRow } from "@tennis-lebanon/api";
import {
  formatPriceMinor,
  isWhatsAppBookingClub,
} from "@tennis-lebanon/domain";
import type { Json } from "@tennis-lebanon/types";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { clubBookingModeLabelKey } from "../lib/club-booking-label";
import {
  clubAmenityI18nKey,
  humanizeClubAmenity,
} from "../lib/club-detail-layout";
import { useLayoutDirection } from "../lib/layout-direction";
import { zoneNameFromJson } from "../lib/zones";
import {
  tennisBrand,
  tennisColors,
  tennisRadii,
  tennisSemantic,
} from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

type ClubDirectoryCardProps = {
  club: ClubDirectoryRow;
  onPress: () => void;
  /** Omit for a plain navigation card; pass to render it as a checkbox. */
  selected?: boolean;
  /** Shorter hero and denser body for pickers and booking flows. */
  compact?: boolean;
};

type BookingBadgeStyle = {
  color: string;
  backgroundColor: string;
};

function bookingBadgeStyle(bookingMode: string): BookingBadgeStyle {
  if (isWhatsAppBookingClub(bookingMode)) {
    return {
      color: tennisBrand.whatsappText,
      backgroundColor: tennisBrand.whatsappFill,
    };
  }

  return {
    color: tennisSemantic.attention.text,
    backgroundColor: tennisSemantic.attention.fill,
  };
}

function MetaChip({ children }: { children: string }) {
  return (
    <View style={styles.metaChip}>
      <AppText style={styles.metaChipText}>{children}</AppText>
    </View>
  );
}

export function ClubDirectoryCardSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden>
      <View style={styles.skeletonHero} />
      <View style={styles.body}>
        <View style={styles.skeletonLine} />
        <View style={styles.skeletonLineShort} />
      </View>
    </View>
  );
}

export function ClubDirectoryCard({
  club,
  onPress,
  selected,
  compact = false,
}: ClubDirectoryCardProps) {
  const { t, i18n } = useTranslation();
  const { rowDirection, writingDirection, isRtl } = useLayoutDirection();
  const price = formatPriceMinor(club.min_price_minor, club.currency);
  const selectable = selected !== undefined;
  const zone = zoneNameFromJson(
    club.zone_name_i18n as Json,
    i18n.resolvedLanguage ?? i18n.language,
  );
  const bookingBadge = bookingBadgeStyle(club.booking_mode);
  const amenities = compact ? [] : club.amenities.slice(0, 3);

  function amenityLabel(amenity: string): string {
    const key = clubAmenityI18nKey(amenity);
    return key ? t(key) : humanizeClubAmenity(amenity);
  }

  return (
    <Pressable
      accessibilityRole={selectable ? "checkbox" : "button"}
      accessibilityLabel={
        club.is_favorite ? `${club.name}, ${t("clubs.favorite")}` : club.name
      }
      accessibilityState={selectable ? { checked: selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <View style={styles.heroPattern}>
          <Icon
            name="court"
            size={compact ? 36 : 64}
            color={tennisColors.white}
          />
        </View>

        {selectable ? (
          <View
            style={[
              styles.selectMark,
              isRtl ? styles.selectMarkRtl : styles.selectMarkLtr,
              selected && styles.selectMarkSelected,
            ]}
          >
            {selected ? <AppText style={styles.selectCheck}>✓</AppText> : null}
          </View>
        ) : null}

        {club.is_favorite ? (
          <View
            style={[
              styles.favoriteBadge,
              isRtl ? styles.favoriteBadgeRtl : styles.favoriteBadgeLtr,
            ]}
          >
            <Icon name="star" size={12} color={tennisColors.limeText} />
          </View>
        ) : null}

        <View
          style={[
            styles.bookingBadge,
            isRtl ? styles.bookingBadgeRtl : styles.bookingBadgeLtr,
            { backgroundColor: bookingBadge.backgroundColor },
          ]}
        >
          <AppText
            style={[styles.bookingBadgeText, { color: bookingBadge.color }]}
          >
            {t(clubBookingModeLabelKey(club.booking_mode))}
          </AppText>
        </View>
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <View style={[styles.titleRow, { flexDirection: rowDirection }]}>
          <View style={styles.titleBlock}>
            <AppText
              style={[
                styles.name,
                compact && styles.nameCompact,
                { writingDirection },
              ]}
              maxLines={2}
            >
              {club.name}
            </AppText>
            <AppText style={[styles.zone, { writingDirection }]} maxLines={1}>
              {zone}
            </AppText>
          </View>
          {price ? (
            <View
              style={[
                styles.priceBlock,
                { alignItems: isRtl ? "flex-start" : "flex-end" },
              ]}
            >
              <AppText style={[styles.price, compact && styles.priceCompact]}>
                {price}
              </AppText>
              {!compact ? (
                <AppText style={styles.priceHint}>
                  {t("clubs.pricePerHour")}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
          <MetaChip>
            {t("clubs.courtCount", { count: club.court_count })}
          </MetaChip>
          <MetaChip>{t("clubs.payAtClub")}</MetaChip>
        </View>

        {amenities.length > 0 ? (
          <View style={[styles.tagRow, { flexDirection: rowDirection }]}>
            {amenities.map((tag) => (
              <View key={tag} style={styles.tag}>
                <AppText style={styles.tagText} maxLines={1}>
                  {amenityLabel(tag)}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      borderWidth: 2,
      borderColor: tennisColors.border,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: tennisColors.card,
    },
    cardCompact: {
      borderRadius: tennisRadii.lg,
    },
    cardSelected: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisColors.secondary,
      shadowColor: tennisColors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 2,
    },
    cardPressed: {
      opacity: 0.92,
    },
    hero: {
      height: 148,
      backgroundColor: tennisColors.photoPlaceholder,
      position: "relative",
      overflow: "hidden",
    },
    heroCompact: {
      height: 72,
    },
    heroPattern: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.28,
    },
    selectMark: {
      position: "absolute",
      top: 10,
      zIndex: 4,
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: tennisColors.white,
      backgroundColor: "rgba(255,255,255,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    selectMarkLtr: {
      left: 10,
    },
    selectMarkRtl: {
      right: 10,
    },
    selectMarkSelected: {
      backgroundColor: tennisColors.primary,
      borderColor: tennisColors.primary,
    },
    selectCheck: {
      color: tennisColors.lime,
      fontSize: 13,
      fontFamily: tennisFontFamily.bodySemi,
      lineHeight: 16,
    },
    favoriteBadge: {
      position: "absolute",
      top: 12,
      zIndex: 3,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: tennisColors.lime,
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteBadgeLtr: {
      right: 12,
    },
    favoriteBadgeRtl: {
      left: 12,
    },
    bookingBadge: {
      position: "absolute",
      bottom: 12,
      zIndex: 3,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: tennisRadii.pill,
    },
    bookingBadgeLtr: {
      left: 12,
    },
    bookingBadgeRtl: {
      right: 12,
    },
    bookingBadgeText: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 11,
    },
    body: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    bodyCompact: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    titleRow: {
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 17,
      color: tennisColors.primaryDark,
      letterSpacing: -0.3,
    },
    nameCompact: {
      fontSize: 15,
      lineHeight: 20,
    },
    zone: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.mutedForeground,
    },
    priceBlock: {
      flexShrink: 0,
    },
    price: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 18,
      color: tennisColors.primary,
      letterSpacing: -0.3,
    },
    priceCompact: {
      fontSize: 15,
      lineHeight: 18,
    },
    priceHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 11,
      color: tennisColors.mutedForeground,
    },
    metaRow: {
      flexWrap: "wrap",
      gap: 8,
    },
    metaChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: tennisColors.muted,
    },
    metaChipText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 11,
      color: tennisColors.mutedForeground,
    },
    tagRow: {
      flexWrap: "wrap",
      gap: 6,
    },
    tag: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: tennisRadii.pill,
      backgroundColor: tennisColors.secondary,
      maxWidth: "100%",
    },
    tagText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 11,
      color: tennisColors.primary,
    },
    skeletonHero: {
      height: 148,
      backgroundColor: tennisColors.muted,
    },
    skeletonLine: {
      height: 14,
      borderRadius: 7,
      backgroundColor: tennisColors.muted,
    },
    skeletonLineShort: {
      height: 14,
      width: "48%",
      borderRadius: 7,
      backgroundColor: tennisColors.muted,
    },
  }),
);
