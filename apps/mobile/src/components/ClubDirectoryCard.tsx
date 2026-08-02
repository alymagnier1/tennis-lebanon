import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { ClubDirectoryRow } from "@tennis-lebanon/api";
import { formatPriceMinor } from "@tennis-lebanon/domain";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import type { Json } from "@tennis-lebanon/types";
import { AppText } from "./AppText";
import { clubBookingModeLabelKey } from "../lib/club-booking-label";
import { mobileBrand } from "../theme/mobile-brand";
import { zoneNameFromJson } from "../lib/zones";

type ClubDirectoryCardProps = {
  club: ClubDirectoryRow;
  onPress: () => void;
  /** Omit for a plain navigation card; pass to render it as a checkbox. */
  selected?: boolean;
};

export function ClubDirectoryCard({
  club,
  onPress,
  selected,
}: ClubDirectoryCardProps) {
  const { t, i18n } = useTranslation();
  const price = formatPriceMinor(club.min_price_minor, club.currency);
  const selectable = selected !== undefined;

  return (
    <Pressable
      accessibilityRole={selectable ? "checkbox" : "button"}
      accessibilityLabel={club.name}
      accessibilityState={selectable ? { checked: selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <AppText style={styles.name} maxLines={1}>
        {club.name}
        {club.is_favorite ? ` · ${t("clubs.favorite")}` : ""}
      </AppText>
      <AppText style={styles.meta} maxLines={2}>
        {zoneNameFromJson(
          club.zone_name_i18n as Json,
          i18n.resolvedLanguage ?? i18n.language,
        )}
        {" · "}
        {t("clubs.courtCount", { count: club.court_count })}
        {price ? ` · ${t("clubs.from", { price })}` : ""}
      </AppText>
      <AppText style={styles.badge} maxLines={1}>
        {t(clubBookingModeLabelKey(club.booking_mode))} · {t("clubs.payAtClub")}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.neutral[0],
  },
  cardSelected: {
    borderColor: mobileBrand[500],
    backgroundColor: mobileBrand[50],
  },
  cardPressed: { opacity: 0.85 },
  name: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  meta: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
  },
  badge: {
    color: colors.brand[700],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
