import type { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WizardProgress } from "../AppUi";
import { AppText } from "../AppText";
import { FigmaBackButton } from "./FigmaButtons";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";

export function OnboardingStepLayout({
  title,
  description,
  step,
  totalSteps,
  onBack,
  children,
  footer,
  scroll = true,
}: PropsWithChildren<{
  title: string;
  description?: string;
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  footer?: ReactNode;
  scroll?: boolean;
}>) {
  const insets = useSafeAreaInsets();

  const body = (
    <>
      {onBack ? <FigmaBackButton onPress={onBack} /> : null}
      {step && totalSteps ? (
        <WizardProgress step={step} totalSteps={totalSteps} />
      ) : null}
      <View style={styles.header}>
        <AppText accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {description ? (
          <AppText style={styles.description}>{description}</AppText>
        ) : null}
      </View>
      {children}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={styles.scrollContent}>{body}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

export function OnboardingFormField({
  label,
  error,
  children,
}: PropsWithChildren<{ label: string; error?: string }>) {
  return (
    <View style={styles.field}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      {children}
      {error ? <AppText style={styles.fieldError}>{error}</AppText> : null}
    </View>
  );
}

export const onboardingInputStyle = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    borderRadius: 12,
    backgroundColor: tennisColors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: tennisFontFamily.body,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  scrollContent: {
    paddingHorizontal: tennisSpacing.screenX,
    paddingBottom: 24,
    flexGrow: 1,
  },
  header: {
    marginTop: 24,
    marginBottom: 28,
  },
  title: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 28,
    lineHeight: 32,
    color: tennisColors.primaryDark,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  description: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    color: tennisColors.mutedForeground,
  },
  footer: {
    paddingHorizontal: tennisSpacing.screenX,
    paddingBottom: 8,
    gap: 10,
  },
  field: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.mutedForeground,
    marginBottom: 8,
  },
  fieldError: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.danger,
    marginTop: 6,
  },
});
