import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { FigmaSecondaryButton } from "../onboarding-ui";
import { PlayerProfileSection } from "./PlayerProfileSection";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { playerReportRoute } from "../../lib/routes";
import { tennisColors } from "../../theme/tennis-tokens";

export function PlayerProfileSafetySection({
  playerId,
  onBlock,
  blockLoading = false,
}: {
  playerId: string;
  onBlock: () => void;
  blockLoading?: boolean;
}) {
  const { t } = useTranslation();
  const { writingDirection } = useLayoutDirection();

  const confirmBlock = () => {
    Alert.alert(
      t("discover.blockConfirmTitle"),
      t("discover.blockConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("discover.blockPlayer"),
          style: "destructive",
          onPress: onBlock,
        },
      ],
    );
  };

  return (
    <PlayerProfileSection title={t("playerProfile.safetyTitle")}>
      <AppText style={[styles.description, { writingDirection }]}>
        {t("playerProfile.safetyDescription")}
      </AppText>
      <View style={styles.actions}>
        <FigmaSecondaryButton
          label={t("discover.reportPlayer")}
          onPress={() => router.push(playerReportRoute(playerId))}
        />
        <FigmaSecondaryButton
          label={t("discover.blockPlayer")}
          disabled={blockLoading}
          onPress={confirmBlock}
        />
      </View>
    </PlayerProfileSection>
  );
}

const styles = StyleSheet.create({
  description: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
