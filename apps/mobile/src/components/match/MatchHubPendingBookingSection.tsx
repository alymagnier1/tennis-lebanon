import { StyleSheet, View } from "react-native";
import type { MatchHubBooking, MatchHubCard } from "@tennis-lebanon/api";
import { formatPriceMinor } from "@tennis-lebanon/domain";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { formatUtcSlotInBeirut } from "../../lib/beirut-time";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  HubDestructiveLink,
  HubSummaryRow,
} from "./HubSummaryRow";
import { hubSectionStyles } from "./hub-section-styles";
import { FigmaPrimaryButton, FigmaSecondaryButton } from "../onboarding-ui";
import {
  canCancelBookingRequest,
  canRespondToBookingAlternative,
} from "@tennis-lebanon/domain";

type MatchHubPendingBookingSectionProps = {
  booking: MatchHubBooking;
  hub: MatchHubCard;
  onCancelBooking: () => void;
  onAcceptAlternative: () => void;
  onDeclineAlternative: () => void;
  alternativePending?: boolean;
};

export function MatchHubPendingBookingSection({
  booking,
  hub,
  onCancelBooking,
  onAcceptAlternative,
  onDeclineAlternative,
  alternativePending = false,
}: MatchHubPendingBookingSectionProps) {
  const { t } = useTranslation();
  const { writingDirection } = useLayoutDirection();

  const statusLabel =
    booking.status === "requested"
      ? t("matches.hub.bookingRequested")
      : booking.status === "alternative_proposed"
        ? t("matches.hub.bookingAlternative")
        : booking.status;

  return (
    <View style={hubSectionStyles.root}>
      <AppText style={hubSectionStyles.sectionLabel}>
        {t("matches.hub.bookingTitle")}
      </AppText>
      <View style={hubSectionStyles.card}>
        <AppText
          style={[hubSectionStyles.secondaryLine, { writingDirection }]}
          maxLines={2}
        >
          {`${booking.club_name} · ${booking.court_name}`}
        </AppText>
        <AppText style={[hubSectionStyles.metaLine, { writingDirection }]} maxLines={2}>
          {formatUtcSlotInBeirut(booking.starts_at, booking.ends_at)}
        </AppText>
        <HubSummaryRow
          label={t("matches.hub.bookingStatus")}
          value={statusLabel}
        />
        {formatPriceMinor(booking.price_minor, booking.currency) ? (
          <HubSummaryRow
            label={t("clubs.payAtClub")}
            value={formatPriceMinor(booking.price_minor, booking.currency)!}
          />
        ) : null}
        {booking.status === "alternative_proposed" &&
        booking.proposed_start_at &&
        booking.proposed_end_at ? (
          <HubSummaryRow
            label={t("matches.hub.bookingAlternative")}
            value={`${booking.proposed_court_name ?? ""} · ${formatUtcSlotInBeirut(
              booking.proposed_start_at,
              booking.proposed_end_at,
            )}`}
          />
        ) : null}
        {booking.club_note ? (
          <AppText style={[hubSectionStyles.noteLine, { writingDirection }]}>
            {booking.club_note}
          </AppText>
        ) : null}

        {canCancelBookingRequest({
          viewerIsCreator: hub.viewer_is_creator,
          bookingStatus: booking.status,
        }) ? (
          <HubDestructiveLink
            label={t("matches.hub.cancelBooking")}
            onPress={onCancelBooking}
          />
        ) : null}

        {canRespondToBookingAlternative({
          viewerIsCreator: hub.viewer_is_creator,
          bookingStatus: booking.status,
        }) ? (
          <View style={styles.inlineActions}>
            <View style={styles.inlineAction}>
              <FigmaPrimaryButton
                label={t("matches.hub.acceptAlternative")}
                disabled={alternativePending}
                onPress={onAcceptAlternative}
              />
            </View>
            <View style={styles.inlineAction}>
              <FigmaSecondaryButton
                label={t("matches.hub.declineAlternative")}
                disabled={alternativePending}
                onPress={onDeclineAlternative}
              />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineActions: {
    flexDirection: "row",
    gap: 8,
  },
  inlineAction: {
    flex: 1,
  },
});
