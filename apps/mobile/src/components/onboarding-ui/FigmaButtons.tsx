import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

export function FigmaPrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  lime = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  /** Lime fill (welcome/complete CTAs) */
  lime?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.primary,
        lime ? styles.primaryLime : null,
        inactive ? styles.primaryDisabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={lime ? tennisColors.limeText : tennisColors.white}
        />
      ) : (
        <AppText
          style={[
            styles.primaryLabel,
            lime ? styles.primaryLabelLime : null,
            inactive ? styles.primaryLabelDisabled : null,
          ]}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

export function FigmaSecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  ghostOnDark = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  ghostOnDark?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.secondary,
        ghostOnDark ? styles.secondaryGhost : null,
        inactive ? styles.secondaryDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={ghostOnDark ? tennisColors.white : tennisColors.primaryDark}
        />
      ) : (
        <AppText
          style={[
            styles.secondaryLabel,
            ghostOnDark ? styles.secondaryLabelGhost : null,
            inactive ? styles.secondaryLabelDisabled : null,
          ]}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

export function FigmaTextButton({
  label,
  onPress,
  onDark = false,
}: {
  label: string;
  onPress: () => void;
  onDark?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.textBtn}
    >
      <AppText
        style={[styles.textBtnLabel, onDark ? styles.textBtnLabelDark : null]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function FigmaBackButton({
  onPress,
  onDark = false,
}: {
  onPress: () => void;
  onDark?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={[styles.backBtn, onDark ? styles.backBtnDark : null]}
      hitSlop={8}
    >
      <AppText
        style={[styles.backChevron, onDark ? styles.backChevronDark : null]}
      >
        ‹
      </AppText>
    </Pressable>
  );
}

export function FigmaCard({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  primary: {
    minHeight: minTouchTargetPx + 10,
    borderRadius: tennisRadii.lg,
    backgroundColor: tennisColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 17,
  },
  primaryLime: {
    backgroundColor: tennisColors.lime,
  },
  primaryDisabled: {
    backgroundColor: tennisColors.muted,
  },
  primaryLabel: {
    fontFamily: tennisFontFamily.heading,
    fontSize: 16,
    color: tennisColors.white,
    letterSpacing: -0.2,
  },
  primaryLabelLime: {
    color: tennisColors.limeText,
  },
  primaryLabelDisabled: {
    color: tennisColors.mutedForeground,
  },
  secondary: {
    minHeight: minTouchTargetPx,
    borderRadius: tennisRadii.lg,
    backgroundColor: tennisColors.card,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  secondaryGhost: {
    backgroundColor: tennisColors.heroOverlay,
    borderColor: tennisColors.heroBorder,
  },
  secondaryDisabled: {
    opacity: 0.55,
  },
  secondaryLabel: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 16,
    color: tennisColors.primaryDark,
  },
  secondaryLabelGhost: {
    color: tennisColors.white,
  },
  secondaryLabelDisabled: {
    color: tennisColors.mutedForeground,
  },
  textBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  textBtnLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primary,
  },
  textBtnLabelDark: {
    color: "rgba(255,255,255,0.4)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: tennisRadii.sm,
    backgroundColor: tennisColors.card,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnDark: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 0,
  },
  backChevron: {
    fontSize: 24,
    lineHeight: 28,
    color: tennisColors.primaryDark,
    marginTop: -2,
  },
  backChevronDark: {
    color: tennisColors.white,
  },
  card: {
    backgroundColor: tennisColors.card,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    borderRadius: tennisRadii.xl,
    padding: 16,
  },
});
