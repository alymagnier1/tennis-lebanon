import { Pressable, StyleSheet, View } from "react-native";
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
import { useLayoutDirection } from "../lib/layout-direction";
import { zoneNameFromJson } from "../lib/zones";
import { tennisBrand, tennisColors, tennisRadii } from "../theme/tennis-tokens";
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
      color: tennisBrand.whatsapp,
      backgroundColor: tennisBrand.whatsappFill,
    };
  }

  return { color: tennisColors.accent, backgroundColor: "#FEF0E7" };
}

function MetaChip({ children }: { children: string }) {
  return (
    <View style={styles.metaChip}>
      <AppText style={styles.metaChipText}>{children}</AppText>
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
  const { rowDirection, writingDirection } = useLayoutDirection();
  const price = formatPriceMinor(club.min_price_minor, club.currency);
  const selectable = selected !== undefined;
  const zone = zoneNameFromJson(
    club.zone_name_i18n as Json,
    i18n.resolvedLanguage ?? i18n.language,
  );
  const bookingBadge = bookingBadgeStyle(club.booking_mode);
  const amenities = compact ? [] : club.amenities.slice(0, 3);

  return (
    <Pressable
      accessibilityRole={selectable ? "checkbox" : "button"}
      accessibilityLabel={club.name}
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
        <View style={styles.heroOverlay} />
        <View style={styles.heroPattern}>
          <Icon
            name="place"
            size={compact ? 32 : 48}
            color={tennisColors.border}
          />
        </View>

        {selectable ? (
          <View
            style={[
              styles.selectMark,
              selected && styles.selectMarkSelected,
            ]}
          >
            {selected ? <AppText style={styles.selectCheck}>✓</AppText> : null}
          </View>
        ) : null}

        {club.is_favorite ? (
          <View style={styles.favoriteBadge}>
            <AppText style={styles.favoriteBadgeText}>
              {t("clubs.favorite")}
            </AppText>
          </View>
        ) : null}

        <View
          style={[
            styles.bookingBadge,
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
            <AppText
              style={[styles.zone, { writingDirection }]}
              maxLines={1}
            >
              {zone}
            </AppText>
          </View>
          {price ? (
            <View style={styles.priceBlock}>
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

        {!compact ? (
          <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
            <MetaChip>
              {t("clubs.courtCount", { count: club.court_count })}
            </MetaChip>
            <MetaChip>{t("clubs.payAtClub")}</MetaChip>
          </View>
        ) : (
          <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
            <MetaChip>
              {t("clubs.courtCount", { count: club.court_count })}
            </MetaChip>
            <MetaChip>
              {t(clubBookingModeLabelKey(club.booking_mode))}
            </MetaChip>
          </View>
        )}

        {amenities.length > 0 ? (
          <View style={[styles.tagRow, { flexDirection: rowDirection }]}>
            {amenities.map((tag) => (
              <View key={tag} style={styles.tag}>
                <AppText style={styles.tagText} maxLines={1}>
                  {tag}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {!selectable ? (
          <View style={styles.cta}>
            <AppText style={styles.ctaLabel}>{t("clubs.viewDetails")}</AppText>
          </View>
        ) : selected ? (
          <AppText style={styles.selectedHint}>{t("clubs.selected")}</AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    height: 160,
    backgroundColor: tennisColors.muted,
    position: "relative",
    overflow: "hidden",
  },
  heroCompact: {
    height: 72,
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 2,
  },
  heroPattern: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.35,
  },
  selectMark: {
    position: "absolute",
    top: 10,
    left: 10,
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
    right: 12,
    zIndex: 3,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: tennisRadii.pill,
    backgroundColor: tennisColors.lime,
  },
  favoriteBadgeText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 11,
    color: tennisColors.limeText,
  },
  bookingBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    zIndex: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tennisRadii.pill,
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
    alignItems: "flex-end",
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
  cta: {
    paddingVertical: 12,
    borderRadius: tennisRadii.md,
    backgroundColor: tennisColors.primary,
    alignItems: "center",
  },
  ctaLabel: {
    fontFamily: tennisFontFamily.heading,
    fontSize: 14,
    color: tennisColors.white,
  },
  selectedHint: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    color: tennisColors.primary,
    textAlign: "center",
  },
});
