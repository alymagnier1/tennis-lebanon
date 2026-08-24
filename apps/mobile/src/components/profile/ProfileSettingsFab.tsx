import { Pressable, StyleSheet } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { Icon } from "../Icon";
import { profileFabBottomOffset } from "../../lib/tab-bar-metrics";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

export function ProfileSettingsFab({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("settings.title")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { bottom: profileFabBottomOffset() },
        pressed && styles.fabPressed,
      ]}
    >
      <Icon name="settings" size={22} color={tennisColors.white} />
    </Pressable>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    fab: {
      position: "absolute",
      right: 20,
      width: 52,
      height: 52,
      borderRadius: tennisRadii.lg,
      backgroundColor: tennisColors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: tennisColors.heroBorder,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    fabPressed: {
      opacity: 0.9,
    },
  }),
);
