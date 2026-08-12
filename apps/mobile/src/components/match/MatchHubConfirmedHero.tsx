import { View } from "react-native";
import type { MatchHubBooking } from "@tennis-lebanon/api";
import { formatPriceMinor } from "@tennis-lebanon/domain";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { formatUtcSlotInBeirut } from "../../lib/beirut-time";
import { useLayoutDirection } from "../../lib/layout-direction";
import { FigmaSecondaryButton } from "../onboarding-ui";
import { hubSectionStyles } from "./hub-section-styles";

type MatchHubConfirmedHeroProps = {
  booking: MatchHubBooking;
  showReschedule?: boolean;
  onReschedule?: () => void;
};

export function MatchHubConfirmedHero({
  booking,
  showReschedule = false,
  onReschedule,
}: MatchHubConfirmedHeroProps) {
  const { t } = useTranslation();
  const { writingDirection } = useLayoutDirection();

  const priceLabel = formatPriceMinor(booking.price_minor, booking.currency);
  const payLine = [
    t("clubs.payAtClub"),
    priceLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={hubSectionStyles.root}>
      <AppText style={hubSectionStyles.sectionLabel}>
        {t("matches.hub.courtHeroTitle")}
      </AppText>
      <View style={hubSectionStyles.card}>
        <AppText
          style={[hubSectionStyles.secondaryLine, { writingDirection }]}
          maxLines={2}
        >
          {`${booking.club_name} · ${booking.court_name}`}
        </AppText>
        <AppText
          style={[hubSectionStyles.primaryLine, { writingDirection }]}
          maxLines={2}
        >
          {formatUtcSlotInBeirut(booking.starts_at, booking.ends_at)}
        </AppText>
        {payLine ? (
          <AppText
            style={[hubSectionStyles.metaLine, { writingDirection }]}
            maxLines={2}
          >
            {payLine}
          </AppText>
        ) : null}
        {booking.club_note ? (
          <AppText style={[hubSectionStyles.noteLine, { writingDirection }]}>
            {booking.club_note}
          </AppText>
        ) : null}
        {showReschedule && onReschedule ? (
          <FigmaSecondaryButton
            label={t("matches.hub.reschedule")}
            onPress={onReschedule}
          />
        ) : null}
      </View>
    </View>
  );
}
