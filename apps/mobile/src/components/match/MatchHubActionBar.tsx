import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { FigmaPrimaryButton } from "../onboarding-ui";
import {
  hubPrimaryActionLabelKey,
  type HubPrimaryActionKind,
} from "../../lib/hub-action-bar";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function MatchHubActionBar({
  actionKind,
  loading = false,
  onPress,
  cancelLabel,
  onCancel,
}: {
  actionKind: HubPrimaryActionKind;
  loading?: boolean;
  onPress: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { rowDirection } = useLayoutDirection();
  const labelKey = hubPrimaryActionLabelKey(actionKind);
  const showPrimary = Boolean(labelKey);
  const showCancel = Boolean(cancelLabel && onCancel);

  if (!showPrimary && !showCancel) {
    return null;
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        {showCancel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              showPrimary ? styles.cancelBesidePrimary : styles.cancelAlone,
              pressed && styles.cancelPressed,
            ]}
          >
            <AppText style={styles.cancelLabel} maxLines={1}>
              {cancelLabel}
            </AppText>
          </Pressable>
        ) : null}

        {showPrimary && labelKey ? (
          <View style={showCancel ? styles.primaryWrap : styles.primaryAlone}>
            <FigmaPrimaryButton
              label={t(labelKey)}
              loading={loading}
              onPress={onPress}
              style={styles.primaryButton}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    bar: {
      borderTopWidth: 1,
      borderTopColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    row: {
      alignItems: "center",
      gap: 10,
    },
    cancelButton: {
      minHeight: minTouchTargetPx,
      borderRadius: tennisRadii.md,
      borderWidth: 1.5,
      borderColor: tennisColors.danger,
      backgroundColor: tennisColors.card,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    cancelBesidePrimary: {
      flexShrink: 0,
    },
    cancelAlone: {
      flex: 1,
    },
    cancelPressed: {
      opacity: 0.88,
      backgroundColor: "#FCECEC",
    },
    cancelLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 15,
      color: tennisColors.danger,
    },
    primaryWrap: {
      flex: 1,
      minWidth: 0,
    },
    primaryAlone: {
      flex: 1,
    },
    primaryButton: {
      width: "100%",
    },
  }),
);
