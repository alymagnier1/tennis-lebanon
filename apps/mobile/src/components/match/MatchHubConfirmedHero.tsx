import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { MatchHubBooking } from "@tennis-lebanon/api";
import { formatPriceMinor } from "@tennis-lebanon/domain";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { useLayoutDirection } from "../../lib/layout-direction";
import { clubDetailRoute } from "../../lib/routes";
import { HubDestructiveLink } from "./HubSummaryRow";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { hubSectionStyles } from "./hub-section-styles";

const PHOTO_PLACEHOLDER = "#E09A5C";

type MatchHubConfirmedHeroProps = {
  booking: MatchHubBooking;
  matchId: string;
  /** Host-only undo for a court the host recorded himself. */
  onRelease?: () => void;
  releasing?: boolean;
};

/**
 * Confirmed venue on the hub — same image club card as the preferred-club
 * picker, so confirm does not feel like a different page.
 */
export function MatchHubConfirmedHero({
  booking,
  matchId,
  onRelease,
  releasing = false,
}: MatchHubConfirmedHeroProps) {
  const { t } = useTranslation();
  const { writingDirection } = useLayoutDirection();
  const priceLabel = formatPriceMinor(booking.price_minor, booking.currency);
  const payLine = [t("clubs.payAtClub"), priceLabel]
    .filter(Boolean)
    .join(" · ");

  function openClub() {
    router.push(clubDetailRoute(booking.club_id, { matchId }));
  }

  return (
    <View style={hubSectionStyles.root}>
      <AppText style={hubSectionStyles.sectionLabel}>
        {t("matches.hub.courtHeroTitle")}
      </AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("matches.hub.openClubDetails", {
          club: booking.club_name,
        })}
        onPress={openClub}
        style={({ pressed }) => [styles.clubCard, pressed && styles.pressed]}
      >
        <View style={styles.cardBody}>
          <View style={styles.infoColumn}>
            <AppText
              style={[styles.clubName, { writingDirection }]}
              maxLines={2}
            >
              {booking.club_name}
            </AppText>
            <AppText
              style={[styles.courtName, { writingDirection }]}
              maxLines={1}
            >
              {booking.court_name}
            </AppText>
            {payLine ? (
              <AppText
                style={[tennisTextStyles.sectionSubtitle, { writingDirection }]}
                maxLines={1}
              >
                {payLine}
              </AppText>
            ) : null}
            {booking.club_note ? (
              <AppText style={[styles.note, { writingDirection }]} maxLines={2}>
                {booking.club_note}
              </AppText>
            ) : null}
          </View>

          <View style={styles.photoHalf} pointerEvents="none">
            <View style={styles.photoSkew}>
              <View style={styles.photoInner}>
                <View style={styles.photoPlaceholder}>
                  <Icon name="place" size={22} color={tennisColors.white} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionRail} pointerEvents="box-none">
            <View />
            <View style={styles.viewClubLink}>
              <AppText style={styles.viewClubLabel} maxLines={1}>
                {t("clubs.viewDetails")}
              </AppText>
              <Icon name="chevron" size={12} color={tennisColors.white} />
            </View>
          </View>
        </View>
      </Pressable>

      {onRelease ? (
        <HubDestructiveLink
          label={t("matches.hub.courtFellThrough")}
          disabled={releasing}
          onPress={onRelease}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clubCard: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.lg,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    overflow: "hidden",
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 88,
    position: "relative",
  },
  infoColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 2,
    paddingTop: 12,
    paddingBottom: 36,
    paddingStart: 12,
    paddingEnd: 16,
    backgroundColor: tennisColors.background,
  },
  clubName: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 14,
    lineHeight: 18,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
  courtName: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
    color: tennisColors.primaryDark,
  },
  note: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    color: tennisColors.mutedForeground,
    marginTop: 2,
  },
  photoHalf: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    backgroundColor: PHOTO_PLACEHOLDER,
  },
  photoSkew: {
    flex: 1,
    marginLeft: -16,
    paddingLeft: 16,
    backgroundColor: PHOTO_PLACEHOLDER,
    transform: [{ skewX: "10deg" }],
  },
  photoInner: {
    flex: 1,
    transform: [{ skewX: "-10deg" }],
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 24,
  },
  actionRail: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 34,
  },
  viewClubLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 34,
  },
  viewClubLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.white,
  },
  pressed: {
    opacity: 0.88,
  },
});
