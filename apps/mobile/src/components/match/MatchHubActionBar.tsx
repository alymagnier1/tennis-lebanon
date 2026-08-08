import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { FigmaPrimaryButton } from "../onboarding-ui";
import {
  hubPrimaryActionLabelKey,
  type HubPrimaryActionKind,
} from "../../lib/hub-action-bar";
import { tennisColors } from "../../theme/tennis-tokens";

export function MatchHubActionBar({
  actionKind,
  loading = false,
  onPress,
}: {
  actionKind: HubPrimaryActionKind;
  loading?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const labelKey = hubPrimaryActionLabelKey(actionKind);

  if (!labelKey) {
    return null;
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <FigmaPrimaryButton
        label={t(labelKey)}
        loading={loading}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
    backgroundColor: tennisColors.card,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
