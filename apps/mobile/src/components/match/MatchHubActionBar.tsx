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
import { tennisColors } from "../../theme/tennis-tokens";
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
    <View
      style={[
        styles.bar,
        !showPrimary && styles.barQuiet,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        {showCancel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            onPress={onCancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.cancelButton,
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
              label={
                actionKind === "invite"
                  ? t("matches.invite.invitePlayer")
                  : t(labelKey)
              }
              loading={loading}
              onPress={onPress}
              testID={`hub-action-${actionKind}`}
              lime={actionKind === "invite"}
              compact={actionKind === "invite" && showCancel}
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
    barQuiet: {
      borderTopWidth: 0,
      backgroundColor: tennisColors.background,
    },
    row: {
      alignItems: "center",
      gap: 10,
    },
    cancelButton: {
      minHeight: minTouchTargetPx,
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    cancelPressed: {
      opacity: 0.7,
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
