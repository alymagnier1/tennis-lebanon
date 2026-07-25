import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import {
  colors,
  minTouchTargetPx,
  radii,
  spacing,
  typography,
} from "@tennis-lebanon/ui";

export function Screen({
  title,
  description,
  children,
  refreshing = false,
  onRefresh,
}: PropsWithChildren<{
  title: string;
  description?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.neutral[0]} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function FormField({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={colors.neutral[500]}
        {...props}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Choice({
  label,
  selected,
  onPress,
  description,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  description?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <View style={styles.choiceText}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {description ? (
          <Text style={styles.choiceDescription}>{description}</Text>
        ) : null}
      </View>
      <Text style={styles.checkmark}>{selected ? "✓" : ""}</Text>
    </Pressable>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" style={styles.errorNotice}>
      {children}
    </Text>
  );
}

export const formStyles = StyleSheet.create({
  stack: { gap: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm },
  summary: {
    backgroundColor: colors.neutral[50],
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryLabel: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
  },
  summaryValue: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
  },
  description: {
    color: colors.neutral[700],
    fontSize: typography.size.md,
    lineHeight: 24,
  },
  title: {
    color: colors.neutral[900],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  hintText: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
  },
  errorText: {
    color: colors.danger[700],
    fontSize: typography.size.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  segmentRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  segmentButtonActive: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[50],
  },
  segmentButtonText: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.neutral[0],
  },
  title: {
    color: colors.neutral[900],
    fontSize: typography.size["2xl"],
    fontWeight: typography.weight.bold,
  },
  description: {
    color: colors.neutral[700],
    fontSize: typography.size.md,
    lineHeight: 24,
  },
  primaryButton: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand[600],
    borderRadius: radii.md,
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  secondaryButton: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand[600],
    borderRadius: radii.md,
  },
  secondaryButtonText: {
    color: colors.brand[700],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  field: { gap: spacing.xs },
  label: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  input: {
    minHeight: minTouchTargetPx,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.neutral[900],
    fontSize: typography.size.md,
  },
  inputError: { borderColor: colors.danger[500] },
  error: { color: colors.danger[700], fontSize: typography.size.sm },
  errorNotice: {
    padding: spacing.md,
    color: colors.danger[700],
    backgroundColor: colors.danger[100],
    borderRadius: radii.md,
  },
  choice: {
    minHeight: minTouchTargetPx,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.md,
  },
  choiceSelected: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[50],
  },
  choiceText: { flex: 1, gap: spacing.xs },
  choiceLabel: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  choiceDescription: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
  },
  checkmark: {
    color: colors.brand[700],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
});
