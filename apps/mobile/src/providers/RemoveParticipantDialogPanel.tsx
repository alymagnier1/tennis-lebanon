import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { AppText } from "../components/AppText";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../components/onboarding-ui/FigmaButtons";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import type { RemoveParticipantDialogOptions } from "../lib/confirm-action";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";

export function RemoveParticipantDialogPanel({
  options,
  writingDirection,
  onClose,
}: {
  options: RemoveParticipantDialogOptions;
  writingDirection: "ltr" | "rtl";
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason) {
      setFieldError(options.reasonRequiredMessage);
      return;
    }

    setFieldError(null);
    setLoading(true);
    try {
      await options.onSubmit(reason);
      onClose();
    } catch {
      setLoading(false);
    }
  }

  function handleDismiss() {
    if (loading) return;
    options.onDismiss?.();
    onClose();
  }

  return (
    <View style={styles.panel}>
      <AppText
        accessibilityRole="header"
        style={[styles.title, { writingDirection }]}
      >
        {options.title}
      </AppText>
      <AppText style={[styles.message, { writingDirection }]} maxLines={8}>
        {options.message}
      </AppText>
      {options.warning ? (
        <AppText style={[styles.warning, { writingDirection }]} maxLines={4}>
          {options.warning}
        </AppText>
      ) : null}
      <AppText style={[styles.reasonLabel, { writingDirection }]}>
        {options.reasonLabel}
      </AppText>
      <View style={styles.reasons}>
        {options.reasons.map((item) => {
          const selected = reason === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: loading }}
              accessibilityLabel={item.label}
              disabled={loading}
              onPress={() => {
                setReason(item.value);
                if (fieldError) setFieldError(null);
              }}
              style={({ pressed }) => [
                styles.reasonRow,
                selected && styles.reasonRowSelected,
                pressed && styles.reasonRowPressed,
              ]}
            >
              <AppText
                style={[
                  styles.reasonText,
                  selected && styles.reasonTextSelected,
                  { writingDirection },
                ]}
                maxLines={2}
              >
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {fieldError ? (
        <AppText style={[styles.error, { writingDirection }]}>
          {fieldError}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <FigmaPrimaryButton
          label={options.submitLabel}
          loading={loading}
          onPress={() => void handleSubmit()}
        />
        <FigmaSecondaryButton
          label={options.dismissLabel}
          disabled={loading}
          onPress={handleDismiss}
        />
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    panel: {
      gap: 12,
    },
    title: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 17,
      lineHeight: 22,
      color: tennisColors.primaryDark,
      letterSpacing: -0.3,
    },
    message: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
    warning: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      lineHeight: 20,
      color: tennisColors.danger,
    },
    reasonLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.primaryDark,
    },
    reasons: {
      gap: 8,
    },
    reasonRow: {
      minHeight: 44,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      justifyContent: "center",
      backgroundColor: tennisColors.card,
    },
    reasonRowSelected: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisColors.muted,
    },
    reasonRowPressed: {
      opacity: 0.92,
    },
    reasonText: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.primaryDark,
    },
    reasonTextSelected: {
      fontFamily: tennisFontFamily.bodyMedium,
    },
    error: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.danger,
    },
    actions: {
      gap: 10,
      marginTop: 4,
    },
  }),
);
