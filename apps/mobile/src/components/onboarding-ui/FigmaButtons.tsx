import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { useLayoutDirection } from "../../lib/layout-direction";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

const PRESS = { transform: [{ scale: 0.985 }], opacity: 0.92 } as const;

function pressStyle(pressed: boolean, extra?: StyleProp<ViewStyle>) {
  return [extra, pressed ? PRESS : null];
}

export function FigmaPrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  lime = false,
  hero = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  /** Lime fill (welcome/complete CTAs on dark). */
  lime?: boolean;
  /** Brand-green fill that does not follow dark-mode lavender. */
  hero?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={() => {
        if (inactive) return;
        onPress();
      }}
      style={({ pressed }) => [
        styles.primary,
        lime ? styles.primaryLime : null,
        hero ? styles.primaryHero : null,
        inactive ? styles.primaryDisabled : null,
        style,
        ...pressStyle(pressed && !inactive),
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={lime ? tennisColors.limeText : tennisColors.onPrimary}
        />
      ) : (
        <AppText
          style={[
            tennisTextStyles.buttonLabel,
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
  ghostOnLight = false,
  neutral = false,
  leading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  ghostOnDark?: boolean;
  ghostOnLight?: boolean;
  /** Google / quiet outline on the form canvas. */
  neutral?: boolean;
  leading?: ReactNode;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={() => {
        if (inactive) return;
        onPress();
      }}
      style={({ pressed }) => [
        styles.secondary,
        ghostOnDark ? styles.secondaryGhost : null,
        ghostOnLight ? styles.secondaryGhostLight : null,
        neutral ? styles.secondaryNeutral : null,
        inactive ? styles.secondaryDisabled : null,
        ...pressStyle(pressed && !inactive),
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={ghostOnDark ? tennisColors.white : tennisColors.heroOnLight}
        />
      ) : (
        <View style={styles.secondaryRow}>
          {leading}
          <AppText
            style={[
              tennisTextStyles.buttonLabel,
              styles.secondaryLabel,
              ghostOnDark ? styles.secondaryLabelGhost : null,
              ghostOnLight ? styles.secondaryLabelGhostLight : null,
              inactive ? styles.secondaryLabelDisabled : null,
            ]}
          >
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

export function GoogleMark() {
  return (
    <FontAwesome
      name="google"
      size={17}
      color="#4285F4"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export function FigmaTextButton({
  label,
  onPress,
  onDark = false,
  align = "center",
}: {
  label: string;
  onPress: () => void;
  onDark?: boolean;
  align?: "center" | "start";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.textBtn, align === "start" ? styles.textBtnStart : null]}
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
  accessibilityLabel,
}: {
  onPress: () => void;
  onDark?: boolean;
  accessibilityLabel?: string;
}) {
  const { t } = useTranslation();
  const { isRtl } = useLayoutDirection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t("common.back")}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.backBtn,
        onDark ? styles.backBtnDark : null,
        ...pressStyle(pressed),
      ]}
    >
      <AppText
        style={[
          styles.backChevron,
          onDark ? styles.backChevronDark : null,
          isRtl ? styles.backChevronRtl : null,
        ]}
      >
        ‹
      </AppText>
    </Pressable>
  );
}

export function FigmaCard({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    primary: {
      height: 54,
      borderRadius: tennisRadii.lg,
      backgroundColor: tennisColors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    primaryLime: {
      backgroundColor: tennisColors.lime,
    },
    primaryHero: {
      backgroundColor: tennisColors.heroGreen,
    },
    primaryDisabled: {
      backgroundColor: tennisColors.muted,
    },
    primaryLabel: {
      color: tennisColors.onPrimary,
      textAlign: "center",
    },
    primaryLabelLime: {
      color: tennisColors.limeText,
    },
    primaryLabelDisabled: {
      color: tennisColors.mutedForeground,
    },
    secondary: {
      height: 50,
      borderRadius: tennisRadii.lg,
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    secondaryGhost: {
      backgroundColor: "rgba(255,255,255,0.10)",
      borderColor: "rgba(255,255,255,0.20)",
    },
    secondaryGhostLight: {
      backgroundColor: "transparent",
      borderColor: "rgba(12,56,46,0.32)",
    },
    secondaryNeutral: {
      backgroundColor: tennisColors.card,
      borderColor: tennisColors.border,
    },
    secondaryDisabled: {
      backgroundColor: tennisColors.muted,
      borderColor: tennisColors.muted,
    },
    secondaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    secondaryLabel: {
      color: tennisColors.heroOnLight,
      textAlign: "center",
    },
    secondaryLabelGhost: {
      color: tennisColors.white,
    },
    secondaryLabelGhostLight: {
      color: tennisColors.heroGreen,
    },
    secondaryLabelDisabled: {
      color: tennisColors.mutedForeground,
    },
    textBtn: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: minTouchTargetPx,
      paddingVertical: 12,
    },
    textBtnStart: {
      alignItems: "flex-start",
    },
    textBtnLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      color: tennisColors.heroGreen,
    },
    textBtnLabelDark: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      color: "rgba(255,255,255,0.55)",
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: tennisRadii.control,
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
      fontSize: 22,
      lineHeight: 26,
      color: tennisColors.heroOnLight,
      marginTop: -2,
    },
    backChevronDark: {
      color: tennisColors.white,
    },
    backChevronRtl: {
      transform: [{ scaleX: -1 }],
    },
    card: {
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.xl,
      padding: 16,
    },
  }),
);
