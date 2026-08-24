import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { AppText } from "../components/AppText";
import { FormField } from "../components/FormUi";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../components/onboarding-ui";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import type { CancelMatchDialogOptions } from "../lib/confirm-action";
import { tennisColors } from "../theme/tennis-tokens";

export function CancelMatchDialogPanel({
  options,
  writingDirection,
  onClose,
}: {
  options: CancelMatchDialogOptions;
  writingDirection: "ltr" | "rtl";
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const trimmed = reason.trim();
    if (options.reasonRequired && trimmed.length < 3) {
      setFieldError(options.reasonRequiredMessage);
      return;
    }

    setFieldError(null);
    setLoading(true);
    try {
      await options.onSubmit(trimmed);
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
      {options.showReasonField !== false ? (
        <FormField
          label={options.reasonLabel}
          value={reason}
          onChangeText={(text) => {
            setReason(text);
            if (fieldError) setFieldError(null);
          }}
          placeholder={options.reasonPlaceholder}
          multiline
          editable={!loading}
          error={fieldError ?? undefined}
        />
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
    actions: {
      gap: 10,
      marginTop: 4,
    },
  }),
);
