import type {
  PropsWithChildren,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  elevation,
  minTouchTargetPx,
  radii,
  semantic,
  spacing,
  typography,
} from "@tennis-lebanon/ui";
import { AppText } from "./AppText";
import { useLayoutDirection } from "../lib/layout-direction";
import { useResponsiveLayout } from "../lib/responsive";
import { mobileBrand } from "../theme/mobile-brand";
import { tennisColors, tennisTypography } from "../theme/tennis-tokens";
import { tennisTextStyles } from "../theme/tennis-text-styles";
import { tennisFontFamily } from "../hooks/useTennisFonts";

export type ScreenVirtualizedListProps = {
  data: readonly unknown[];
  keyExtractor: (item: unknown, index: number) => string;
  renderItem: (info: { item: unknown; index: number }) => ReactElement | null;
};

const LIST_PERFORMANCE_PROPS = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 10,
  windowSize: 7,
  removeClippedSubviews: true,
} as const;

export function Screen({
  title,
  description,
  children,
  refreshing = false,
  onRefresh,
  contentGrow = true,
  showTitle = true,
  fixedHeader,
  virtualizedList,
  scrollRef,
}: PropsWithChildren<{
  title: string;
  description?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentGrow?: boolean;
  showTitle?: boolean;
  fixedHeader?: ReactNode;
  virtualizedList?: ScreenVirtualizedListProps;
  scrollRef?: RefObject<ScrollView | null>;
}>) {
  const insets = useSafeAreaInsets();
  const { horizontalPadding, titleFontSize } = useResponsiveLayout();
  const { writingDirection } = useLayoutDirection();
  const edgePadding = Math.max(horizontalPadding, insets.left, insets.right);

  const titleBlock =
    (showTitle && title) || description ? (
      <View style={tennisTextStyles.titleSubtitleBlock}>
        {showTitle && title ? (
          <AppText
            accessibilityRole="header"
            style={[
              styles.title,
              { fontSize: titleFontSize, writingDirection },
            ]}
            maxLines={2}
          >
            {title}
          </AppText>
        ) : null}
        {description ? (
          <AppText
            style={[tennisTextStyles.pageSubtitle, { writingDirection }]}
          >
            {description}
          </AppText>
        ) : null}
      </View>
    ) : null;

  const refreshControl = onRefresh ? (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  ) : undefined;

  const renderVirtualizedBody = (
    paddingHorizontal: number,
    paddingBottom: number,
    belowFixedHeader = false,
  ) => {
    if (!virtualizedList) {
      return null;
    }

    const listRenderItem: ListRenderItem<unknown> = ({ item, index }) =>
      virtualizedList.renderItem({ item, index });

    return (
      <FlatList
        style={styles.scroll}
        data={virtualizedList.data}
        keyExtractor={virtualizedList.keyExtractor}
        renderItem={listRenderItem}
        ListHeaderComponent={
          <>
            {!fixedHeader ? titleBlock : null}
            {children}
          </>
        }
        contentContainerStyle={[
          styles.screen,
          belowFixedHeader && styles.screenBelowFixedHeader,
          !contentGrow && styles.screenCompact,
          {
            paddingHorizontal,
            paddingBottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        ItemSeparatorComponent={ListItemSeparator}
        {...LIST_PERFORMANCE_PROPS}
      />
    );
  };

  if (fixedHeader) {
    const body = renderVirtualizedBody(
      edgePadding,
      Math.max(insets.bottom, spacing.lg),
      true,
    );

    return (
      <View style={styles.screenRoot}>
        <View
          style={[
            styles.fixedHeader,
            {
              paddingHorizontal: edgePadding,
              paddingTop: spacing.sm,
            },
          ]}
        >
          {titleBlock}
          {fixedHeader}
        </View>
        {body ?? (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.screen,
              styles.screenBelowFixedHeader,
              !contentGrow && styles.screenCompact,
              {
                paddingHorizontal: edgePadding,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        )}
      </View>
    );
  }

  const body = renderVirtualizedBody(
    edgePadding,
    Math.max(insets.bottom, spacing.lg),
  );

  if (body) {
    return body;
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[
        styles.screen,
        !contentGrow && styles.screenCompact,
        {
          paddingHorizontal: edgePadding,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {titleBlock}
      {children}
    </ScrollView>
  );
}

function ListItemSeparator() {
  return <View style={styles.listItemSeparator} />;
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
        <AppText style={styles.primaryButtonText} maxLines={2}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={mobileBrand[600]} />
      ) : (
        <AppText style={styles.secondaryButtonText} maxLines={2}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

export function DestructiveButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.destructiveButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.danger[700]} />
      ) : (
        <AppText style={styles.destructiveButtonText} maxLines={2}>
          {label}
        </AppText>
      )}
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
      <AppText style={styles.label}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        maxFontSizeMultiplier={1.3}
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={colors.neutral[500]}
        {...props}
      />
      {error ? (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
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
  const { rowDirection } = useLayoutDirection();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.choice,
        { flexDirection: rowDirection },
        selected && styles.choiceSelected,
      ]}
    >
      <View style={styles.choiceText}>
        <AppText style={styles.choiceLabel} maxLines={2}>
          {label}
        </AppText>
        {description ? (
          <AppText style={styles.choiceDescription} maxLines={3}>
            {description}
          </AppText>
        ) : null}
      </View>
      <AppText style={styles.checkmark}>{selected ? "✓" : ""}</AppText>
    </Pressable>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <AppText accessibilityRole="alert" style={styles.errorNotice}>
      {children}
    </AppText>
  );
}

export function ScreenError({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel: string;
}) {
  return (
    <View style={styles.screenError}>
      <AppText accessibilityRole="alert" style={styles.errorNotice}>
        {message}
      </AppText>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.screenErrorRetry}
        >
          <AppText style={styles.screenErrorRetryLabel}>{retryLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  if (!value) {
    return null;
  }

  return (
    <View style={[formStyles.summaryRow, { flexDirection: rowDirection }]}>
      <AppText style={formStyles.summaryRowLabel} maxLines={1}>
        {label}
      </AppText>
      <AppText
        style={[
          formStyles.summaryRowValue,
          {
            writingDirection,
            textAlign: writingDirection === "rtl" ? "left" : "right",
          },
        ]}
        maxLines={2}
      >
        {value}
      </AppText>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  stack: { gap: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
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
    fontFamily: tennisFontFamily.body,
    fontSize: tennisTypography.fieldHint.fontSize,
    lineHeight: tennisTypography.fieldHint.lineHeight,
    color: colors.neutral[700],
  },
  errorText: {
    color: colors.danger[700],
    fontSize: typography.size.sm,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: semantic.surface,
    ...elevation.sm,
  },
  compactCard: {
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
    backgroundColor: colors.neutral[0],
  },
  compactCardTitle: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: 2,
  },
  summaryRow: {
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  summaryRowLabel: {
    color: colors.neutral[500],
    fontSize: typography.size.xs,
    flexShrink: 0,
    minWidth: 56,
  },
  summaryRowValue: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    flex: 1,
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
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[50],
  },
  segmentButtonActive: {
    backgroundColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentButtonText: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  segmentButtonTextActive: {
    color: mobileBrand[600],
  },
});

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  scroll: {
    flex: 1,
  },
  fixedHeader: {
    gap: spacing.sm,
    backgroundColor: tennisColors.background,
  },
  screen: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    backgroundColor: tennisColors.background,
  },
  screenBelowFixedHeader: {
    paddingTop: spacing.sm,
  },
  screenCompact: {
    flexGrow: 0,
  },
  listItemSeparator: {
    height: spacing.md,
  },
  title: {
    color: tennisColors.primaryDark,
    fontFamily: tennisFontFamily.headingExtra,
    fontWeight: typography.weight.bold,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    // brand[500] gave white text only 2.4:1 and read as disabled.
    backgroundColor: tennisColors.primary,
    borderRadius: radii.full,
    ...elevation.sm,
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
  secondaryButton: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: mobileBrand[500],
    borderRadius: radii.full,
    backgroundColor: colors.neutral[0],
  },
  secondaryButtonText: {
    color: mobileBrand[700],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
  destructiveButton: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger[500],
    borderRadius: radii.full,
    backgroundColor: colors.neutral[0],
  },
  destructiveButtonText: {
    color: colors.danger[700],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
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
  screenError: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  screenErrorRetry: {
    alignSelf: "flex-start",
    minHeight: minTouchTargetPx,
    justifyContent: "center",
  },
  screenErrorRetryLabel: {
    color: colors.brand[700],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  choice: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.lg,
    backgroundColor: colors.neutral[0],
  },
  choiceSelected: {
    borderColor: mobileBrand[500],
    backgroundColor: mobileBrand[50],
  },
  choiceText: { flex: 1, gap: spacing.xs, minWidth: 0 },
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
    color: mobileBrand[700],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
});
