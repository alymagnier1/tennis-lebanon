import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { formatUtcSlotInBeirut } from "../../lib/beirut-time";
import { useLayoutDirection } from "../../lib/layout-direction";
import { FigmaSecondaryButton } from "../onboarding-ui";
import { hubSectionStyles } from "./hub-section-styles";

type MatchHubAgreedTimeHeroProps = {
  startsAt: string;
  endsAt: string;
  venueHint?: string;
  showReschedule?: boolean;
  onReschedule?: () => void;
};

export function MatchHubAgreedTimeHero({
  startsAt,
  endsAt,
  venueHint,
  showReschedule = false,
  onReschedule,
}: MatchHubAgreedTimeHeroProps) {
  const { t } = useTranslation();
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={hubSectionStyles.root}>
      <AppText style={hubSectionStyles.sectionLabel}>
        {t("matches.hub.agreedTime")}
      </AppText>
      <View style={hubSectionStyles.card}>
        <AppText
          style={[hubSectionStyles.primaryLine, { writingDirection }]}
          maxLines={2}
        >
          {formatUtcSlotInBeirut(startsAt, endsAt)}
        </AppText>
        <AppText style={[styles.hint, { writingDirection }]} maxLines={2}>
          {venueHint
            ? `${t("matches.hub.agreedTimeVenueHint")} · ${venueHint}`
            : t("matches.hub.agreedTimeBookHint")}
        </AppText>
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

const styles = StyleSheet.create({
  hint: {
    ...hubSectionStyles.metaLine,
  },
});
