import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { confirmAction } from "../../lib/confirm-action";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
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
  const { rowDirection, writingDirection } = useLayoutDirection();

  const confirmBlock = () => {
    confirmAction({
      title: t("discover.blockConfirmTitle"),
      message: t("discover.blockConfirmBody"),
      confirmLabel: t("discover.blockPlayer"),
      cancelLabel: t("common.cancel"),
      onConfirm: onBlock,
    });
  };

  return (
    <View
      accessibilityHint={t("playerProfile.safetyDescription")}
      style={[styles.row, { flexDirection: rowDirection }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("discover.reportPlayer")}
        onPress={() => router.push(playerReportRoute(playerId))}
        style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
      >
        <AppText style={[styles.linkText, { writingDirection }]}>
          {t("discover.reportPlayer")}
        </AppText>
      </Pressable>
      <AppText style={styles.separator} accessible={false}>
        ·
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("discover.blockPlayer")}
        accessibilityState={{ disabled: blockLoading }}
        disabled={blockLoading}
        onPress={confirmBlock}
        style={({ pressed }) => [
          styles.link,
          pressed && styles.linkPressed,
          blockLoading && styles.linkDisabled,
        ]}
      >
        <AppText style={[styles.linkText, { writingDirection }]}>
          {t("discover.blockPlayer")}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    row: {
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 8,
    },
    link: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    linkPressed: {
      opacity: 0.7,
    },
    linkDisabled: {
      opacity: 0.5,
    },
    linkText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    separator: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
  }),
);
