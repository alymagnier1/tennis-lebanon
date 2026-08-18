import type { PropsWithChildren, ReactNode } from "react";
import { memo, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  ActivityIndicator,
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
import { initialsFromName } from "../lib/avatar-url";
import { useAvatarUrl } from "../lib/use-avatar-url";
import { buildCardAccessibilityLabel } from "../lib/card-accessibility";
import { useConfirmDialogVisible } from "../providers/ConfirmDialogProvider";
import { useLayoutDirection } from "../lib/layout-direction";
import { formatTabBadgeCount } from "../lib/match-list-card";
import { useResponsiveLayout } from "../lib/responsive";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { SemanticBadge } from "./SemanticBadge";
import type { MatchListBadge } from "../lib/match-status-tone";
import { mobileBrand } from "../theme/mobile-brand";
import {
  tennisColors,
  tennisRadii,
  type SemanticTone,
  tennisSemantic,
} from "../theme/tennis-tokens";
import { tennisTextStyles } from "../theme/tennis-text-styles";
import { tennisFontFamily } from "../hooks/useTennisFonts";

export function SegmentTabs<T extends string>({
  value,
  options,
  onChange,
  variant = "primary",
}: {
  value: T;
  options: { value: T; label: string; badgeCount?: number }[];
  onChange: (value: T) => void;
  /** Nested sits under a parent segment (e.g. Active → Now / Upcoming). */
  variant?: "primary" | "nested";
}) {
  const { rowDirection, writingDirection, isRtl } = useLayoutDirection();
  const nested = variant === "nested";

  return (
    <View
      style={[
        nested && styles.segmentTabsNestedRail,
        nested && (isRtl ? styles.segmentTabsNestedRailRtl : null),
      ]}
    >
      <View
        style={[
          nested ? styles.segmentTabsNested : styles.segmentTabs,
          { flexDirection: rowDirection },
        ]}
        accessibilityRole="tablist"
      >
        {options.map((option) => {
          const selected = option.value === value;
          const badgeLabel = formatTabBadgeCount(option.badgeCount ?? 0);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityLabel={
                badgeLabel ? `${option.label}, ${badgeLabel}` : option.label
              }
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                nested ? styles.segmentTabNested : styles.segmentTab,
                selected &&
                  (nested
                    ? styles.segmentTabNestedActive
                    : styles.segmentTabActive),
              ]}
            >
              <View
                style={[
                  styles.segmentTabLabelRow,
                  { flexDirection: rowDirection },
                ]}
              >
                <AppText
                  style={[
                    nested
                      ? styles.segmentTabTextNested
                      : styles.segmentTabText,
                    selected &&
                      (nested
                        ? styles.segmentTabTextNestedActive
                        : styles.segmentTabTextActive),
                    { writingDirection },
                  ]}
                  maxLines={2}
                >
                  {option.label}
                </AppText>
                {badgeLabel ? (
                  <View
                    style={[
                      styles.segmentTabBadge,
                      nested && styles.segmentTabBadgeNested,
                    ]}
                  >
                    <AppText style={styles.segmentTabBadgeText}>
                      {badgeLabel}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function WizardProgress({
  step,
  totalSteps,
}: {
  step: number;
  totalSteps: number;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 1,
        max: totalSteps,
        now: step,
      }}
      style={styles.wizardProgress}
    >
      {Array.from({ length: totalSteps }, (_, index) => (
        <View
          key={index}
          style={[
            styles.wizardSegment,
            index < step && styles.wizardSegmentActive,
          ]}
        />
      ))}
    </View>
  );
}

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={tennisTextStyles.titleSubtitleBlock}>
      <AppText
        accessibilityRole="header"
        style={[styles.sectionTitleText, { writingDirection }]}
        maxLines={2}
      >
        {title}
      </AppText>
      {subtitle ? (
        <AppText
          style={[tennisTextStyles.sectionSubtitle, { writingDirection }]}
          maxLines={3}
        >
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { writingDirection } = useLayoutDirection();
  const { narrow } = useResponsiveLayout();

  return (
    <View style={styles.chipSection}>
      {label ? (
        <AppText style={[styles.chipSectionLabel, { writingDirection }]}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.chipGrid}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                narrow && styles.chipNarrow,
                selected && styles.chipSelected,
              ]}
            >
              <AppText
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                  { writingDirection },
                ]}
                maxLines={2}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ChipMultiSelect({
  label,
  options,
  values,
  onToggle,
}: {
  label?: string;
  options: { value: string; label: string }[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  const { writingDirection } = useLayoutDirection();
  const { narrow } = useResponsiveLayout();

  return (
    <View style={styles.chipSection}>
      {label ? (
        <AppText style={[styles.chipSectionLabel, { writingDirection }]}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.chipGrid}>
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              onPress={() => onToggle(option.value)}
              style={[
                styles.chip,
                narrow && styles.chipNarrow,
                selected && styles.chipSelected,
              ]}
            >
              <AppText
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                  { writingDirection },
                ]}
                maxLines={2}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Avatar({
  name,
  avatarPath,
  size = 48,
  borderRadius,
}: {
  name: string;
  avatarPath?: string | null;
  size?: number;
  borderRadius?: number;
}) {
  const avatarQuery = useAvatarUrl(avatarPath ?? null);
  const uri = avatarQuery.data;
  const radius = borderRadius ?? size / 2;
  const dimension = { width: size, height: size, borderRadius: radius };

  if (avatarPath && avatarQuery.isLoading) {
    return (
      <View style={[styles.avatarFallback, dimension, styles.avatarLoading]}>
        <ActivityIndicator size="small" color={tennisColors.primary} />
      </View>
    );
  }

  if (uri) {
    return (
      <Image
        accessibilityLabel={name}
        source={{ uri }}
        style={[styles.avatarImage, dimension]}
      />
    );
  }

  return (
    <View style={[styles.avatarFallback, dimension]}>
      <AppText style={[styles.avatarInitials, { fontSize: size * 0.38 }]}>
        {initialsFromName(name)}
      </AppText>
    </View>
  );
}

export const PlayerCard = memo(function PlayerCard({
  name,
  avatarPath,
  levelLabel,
  locationLabel,
  hint,
  onPress,
  trailing,
}: {
  name: string;
  avatarPath?: string | null;
  levelLabel: string;
  locationLabel: string;
  hint?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();
  const accessibilityLabel = buildCardAccessibilityLabel([
    name,
    levelLabel,
    locationLabel,
    hint,
  ]);

  // One identity line, one meta line, and the shared-time pill as the hero.
  // Four stacked rows of shrinking text made the reader work out the answer
  // to "should I play with this person" instead of being shown it.
  const content = (
    <>
      <Avatar name={name} avatarPath={avatarPath} size={56} />
      <View style={styles.playerCardBody}>
        <View
          style={[styles.playerCardHeader, { flexDirection: rowDirection }]}
        >
          <AppText
            style={[styles.playerCardName, { writingDirection }]}
            maxLines={1}
          >
            {name}
          </AppText>
          <AppText style={styles.playerCardLevel} maxLines={1}>
            {levelLabel}
          </AppText>
        </View>
        {locationLabel ? (
          <View
            style={[styles.playerCardMetaRow, { flexDirection: rowDirection }]}
          >
            <Icon name="place" size={typography.size.sm} />
            <AppText
              style={[styles.playerCardMeta, { writingDirection }]}
              maxLines={1}
            >
              {locationLabel}
            </AppText>
          </View>
        ) : null}
        {hint ? (
          <AppText
            style={[styles.playerCardHint, { writingDirection }]}
            maxLines={2}
          >
            {hint}
          </AppText>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron" size={20} /> : null)}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.playerCard, { flexDirection: rowDirection }]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.playerCard,
        { flexDirection: rowDirection },
        pressed && styles.playerCardPressed,
      ]}
    >
      {content}
    </Pressable>
  );
});

export function PlayerInviteAction({
  label,
  invitedLabel,
  invited,
  disabled = false,
  loading = false,
  onPress,
}: {
  label: string;
  invitedLabel: string;
  invited: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
}) {
  const { writingDirection } = useLayoutDirection();

  if (invited) {
    return (
      <View style={styles.inviteActionInvited}>
        <AppText
          style={[styles.inviteActionInvitedText, { writingDirection }]}
          maxLines={1}
        >
          {invitedLabel}
        </AppText>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.inviteActionButton,
        (disabled || loading) && styles.inviteActionDisabled,
        pressed && styles.inviteActionPressed,
      ]}
    >
      <AppText
        style={[styles.inviteActionButtonText, { writingDirection }]}
        maxLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export { FigmaMatchCard as MatchCard } from "./match/FigmaMatchCard";
export type { MatchCardProps } from "./match/FigmaMatchCard";

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.emptyState}>
      <View accessibilityElementsHidden style={styles.emptyIcon}>
        <Icon name={icon ?? "court"} size={56} color={colors.neutral[300]} />
      </View>
      <AppText style={[styles.emptyTitle, { writingDirection }]} maxLines={3}>
        {title}
      </AppText>
      <AppText style={[styles.emptyBody, { writingDirection }]} maxLines={5}>
        {body}
      </AppText>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function ToolbarRow({
  items,
}: {
  items: {
    label: string;
    onPress: () => void;
    active?: boolean;
    open?: boolean;
  }[];
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.toolbar}>
      {items.map((item, index) => {
        const highlighted = item.open || item.active;

        return (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ expanded: item.open }}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.toolbarItem,
              index < items.length - 1 && styles.toolbarItemDivider,
              item.open && styles.toolbarItemOpen,
              pressed && styles.toolbarItemPressed,
            ]}
          >
            <AppText
              style={[
                styles.toolbarText,
                highlighted && styles.toolbarTextActive,
                { writingDirection },
              ]}
              maxLines={1}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const SHEET_FADE_MS = 200;

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
}>) {
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsiveLayout();
  const { writingDirection } = useLayoutDirection();
  const confirmDialogVisible = useConfirmDialogVisible();
  const [rendered, setRendered] = useState(visible);
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      void Promise.resolve().then(() => {
        setRendered(true);
        Animated.timing(opacity, {
          toValue: 1,
          duration: SHEET_FADE_MS,
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: SHEET_FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRendered(false);
      }
    });
  }, [opacity, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const update = () => {
        const covered = Math.max(
          0,
          window.innerHeight - viewport.height - viewport.offsetTop,
        );
        setKeyboardHeight(covered);
      };
      update();
      viewport.addEventListener("resize", update);
      viewport.addEventListener("scroll", update);
      return () => {
        viewport.removeEventListener("resize", update);
        viewport.removeEventListener("scroll", update);
      };
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [visible]);

  if (!rendered) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={rendered}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.sheetRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        pointerEvents={confirmDialogVisible ? "none" : "auto"}
      >
        <Animated.View
          pointerEvents={confirmDialogVisible ? "none" : "auto"}
          style={[
            styles.sheetBackdrop,
            {
              opacity: confirmDialogVisible ? 0 : opacity,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          pointerEvents={confirmDialogVisible ? "none" : "auto"}
          style={[
            styles.sheetContainer,
            { opacity },
            {
              paddingHorizontal: Math.max(
                horizontalPadding,
                insets.left,
                insets.right,
              ),
              paddingBottom:
                Math.max(insets.bottom, spacing.xl) +
                (Platform.OS === "ios" ? 0 : keyboardHeight),
              maxHeight: keyboardHeight > 0 ? "92%" : "85%",
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <AppText
            style={[styles.sheetTitle, { writingDirection }]}
            maxLines={2}
          >
            {title}
          </AppText>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={[
              styles.sheetContent,
              keyboardHeight > 0 ? styles.sheetContentKeyboard : null,
            ]}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetOption({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.sheetOption, { flexDirection: rowDirection }]}
    >
      <View style={styles.sheetOptionText}>
        <AppText
          style={[styles.sheetOptionLabel, { writingDirection }]}
          maxLines={2}
        >
          {label}
        </AppText>
        {description ? (
          <AppText
            style={[styles.sheetOptionDescription, { writingDirection }]}
            maxLines={2}
          >
            {description}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

export function FormSection({
  title,
  subtitle,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
}>) {
  return (
    <View style={styles.formSection}>
      <SectionTitle title={title} subtitle={subtitle} />
      <View style={styles.formSectionBody}>{children}</View>
    </View>
  );
}

export function AnimatedCollapse({
  visible,
  children,
}: PropsWithChildren<{ visible: boolean }>) {
  // Lazy state rather than `useRef(...).current`, which reads a ref during
  // render. Matches how BottomSheet in this file already holds its value.
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, visible]);

  const animatedHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(contentHeight, 1)],
  });

  return (
    <View>
      {contentHeight === 0 ? (
        <View
          pointerEvents="none"
          style={styles.collapseMeasure}
          onLayout={(event) =>
            setContentHeight(event.nativeEvent.layout.height)
          }
        >
          {children}
        </View>
      ) : null}
      <Animated.View
        style={[
          styles.collapseContainer,
          { height: animatedHeight, opacity: progress },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export function SettingToggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  variant = "default",
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  variant?: "default" | "card";
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View
      style={[
        styles.settingRow,
        variant === "card" && styles.settingRowCard,
        { flexDirection: rowDirection },
      ]}
    >
      <View style={styles.settingText}>
        <AppText
          style={[styles.settingLabel, { writingDirection }]}
          maxLines={2}
        >
          {label}
        </AppText>
        {description ? (
          <AppText
            style={[styles.settingDescription, { writingDirection }]}
            maxLines={3}
          >
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.neutral[300],
          true: variant === "card" ? tennisColors.primary : mobileBrand[300],
        }}
        thumbColor={
          value
            ? variant === "card"
              ? tennisColors.white
              : mobileBrand[500]
            : colors.neutral[0]
        }
      />
    </View>
  );
}

export function StatusBanner({
  title,
  body,
  actions,
  tone = "info",
}: {
  title?: string;
  body: string;
  actions?: ReactNode;
  tone?: SemanticTone;
}) {
  const { writingDirection } = useLayoutDirection();
  const palette = tennisSemantic[tone];

  return (
    <View
      style={[
        styles.statusBanner,
        { backgroundColor: palette.fill, borderColor: palette.border },
      ]}
    >
      {title ? (
        <AppText
          style={[
            styles.statusBannerTitle,
            { color: palette.text, writingDirection },
          ]}
          maxLines={2}
        >
          {title}
        </AppText>
      ) : null}
      <AppText
        style={[
          styles.statusBannerBody,
          { color: palette.text, writingDirection },
        ]}
        maxLines={4}
      >
        {body}
      </AppText>
      {actions ? (
        <View style={styles.statusBannerActions}>{actions}</View>
      ) : null}
    </View>
  );
}

export const appStyles = StyleSheet.create({
  screenGap: { gap: spacing.lg },
  cardList: { gap: spacing.md },
});

const styles = StyleSheet.create({
  segmentTabs: {
    gap: spacing.sm,
    backgroundColor: tennisColors.muted,
    borderRadius: tennisRadii.lg,
    padding: spacing.xs,
  },
  segmentTabsNestedRail: {
    marginTop: -2,
    paddingStart: spacing.lg,
  },
  segmentTabsNestedRailRtl: {
    paddingStart: 0,
    paddingEnd: spacing.lg,
  },
  segmentTabsNested: {
    gap: spacing.xs,
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tennisColors.border,
  },
  segmentTab: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tennisRadii.md,
    paddingHorizontal: spacing.md,
  },
  segmentTabNested: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -StyleSheet.hairlineWidth,
  },
  segmentTabLabelRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    maxWidth: "100%",
  },
  segmentTabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: tennisColors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentTabBadgeNested: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  segmentTabBadgeText: {
    color: tennisColors.white,
    fontSize: 10,
    lineHeight: 12,
    fontFamily: tennisFontFamily.bodySemi,
  },
  segmentTabActive: {
    backgroundColor: tennisColors.card,
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentTabNestedActive: {
    borderBottomColor: tennisColors.primary,
  },
  segmentTabText: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
    flexShrink: 1,
  },
  segmentTabTextNested: {
    color: tennisColors.mutedForeground,
    fontSize: 12,
    fontFamily: tennisFontFamily.bodyMedium,
    textAlign: "center",
    flexShrink: 1,
  },
  segmentTabTextActive: {
    color: tennisColors.primary,
    fontFamily: tennisFontFamily.headingSemi,
  },
  segmentTabTextNestedActive: {
    color: tennisColors.primary,
    fontFamily: tennisFontFamily.headingSemi,
  },
  wizardProgress: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  wizardSegment: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: tennisColors.muted,
  },
  wizardSegmentActive: {
    backgroundColor: tennisColors.primary,
  },
  sectionTitleText: {
    color: colors.neutral[900],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  chipSection: { gap: spacing.sm },
  chipSectionLabel: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    minHeight: minTouchTargetPx,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.lg,
    backgroundColor: colors.neutral[0],
    maxWidth: "100%",
  },
  chipNarrow: {
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    borderColor: mobileBrand[500],
    backgroundColor: mobileBrand[50],
  },
  chipText: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  chipTextSelected: {
    color: mobileBrand[700],
    fontWeight: typography.weight.semibold,
  },
  avatarImage: {
    backgroundColor: colors.neutral[100],
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileBrand[100],
  },
  avatarLoading: {
    backgroundColor: colors.neutral[100],
  },
  avatarInitials: {
    color: mobileBrand[700],
    fontWeight: typography.weight.bold,
  },
  playerCard: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: tennisColors.card,
    borderWidth: 1,
    borderColor: tennisColors.border,
  },
  playerCardPressed: { opacity: 0.85 },
  playerCardBody: { flex: 1, gap: 2, minWidth: 0 },
  playerCardHeader: {
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  playerCardName: {
    flexShrink: 1,
    color: semantic.textPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  /** Level reads faster as a chip than as a word in a sentence. */
  playerCardLevel: {
    flexShrink: 0,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: mobileBrand[50],
    color: mobileBrand[700],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  playerCardMetaRow: {
    alignItems: "center",
    gap: spacing.xs,
    minWidth: 0,
  },
  playerCardMeta: {
    flexShrink: 1,
    color: semantic.textTertiary,
    fontSize: typography.size.sm,
  },
  // The hint carries the shared-availability slot, which is the fact that
  // makes someone tap. It was the smallest text on the card; it now reads as
  // a tinted pill at body-adjacent size.
  playerCardHint: {
    alignSelf: "flex-start",
    overflow: "hidden",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.success[50],
    color: colors.success[700],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  inviteActionButton: {
    minWidth: 72,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: tennisColors.primary,
  },
  inviteActionButtonText: {
    color: colors.neutral[0],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  inviteActionPressed: { opacity: 0.85 },
  inviteActionDisabled: { opacity: 0.5 },
  inviteActionInvited: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  inviteActionInvitedText: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  matchCard: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: tennisColors.card,
    borderWidth: 1,
    borderColor: tennisColors.border,
  },
  matchCardBody: { flex: 1, gap: spacing.xs, minWidth: 0 },
  matchCardBadgeRow: {
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  matchCardTitle: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  // Bare warning-coloured text read as an error rather than a status.
  matchCardBadge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.warning[100],
    color: colors.warning[700],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  matchCardSubtitle: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  matchCardMeta: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
  },
  matchCardNote: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyIcon: { alignItems: "center", justifyContent: "center" },
  emptyTitle: {
    color: colors.neutral[900],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: "center",
  },
  emptyBody: {
    color: colors.neutral[700],
    fontSize: typography.size.md,
    lineHeight: 22,
    textAlign: "center",
  },
  emptyAction: {
    width: "100%",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  skeletonList: {
    gap: spacing.md,
  },
  skeletonCard: {
    height: 88,
    borderRadius: radii.lg,
    backgroundColor: tennisColors.muted,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: semantic.border,
  },
  toolbarItem: {
    flex: 1,
    alignItems: "center",
    minHeight: minTouchTargetPx,
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  toolbarItemOpen: {
    backgroundColor: mobileBrand[50],
  },
  toolbarItemPressed: {
    opacity: 0.85,
  },
  toolbarItemDivider: {
    borderRightWidth: 1,
    borderRightColor: semantic.border,
  },
  toolbarText: {
    textAlign: "center",
    color: colors.neutral[700],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  toolbarTextActive: {
    color: mobileBrand[600],
    fontWeight: typography.weight.semibold,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(22, 25, 28, 0.4)",
  },
  sheetContainer: {
    maxHeight: "85%",
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.sm,
    zIndex: 2,
    elevation: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[300],
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    textAlign: "center",
    color: colors.neutral[900],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.lg,
  },
  sheetContent: { gap: spacing.lg, paddingBottom: spacing.lg },
  sheetContentKeyboard: { paddingBottom: spacing.xl * 2 },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: semantic.border,
  },
  sheetFooterButton: {
    flex: 1,
  },
  sheetOption: {
    alignItems: "center",
    gap: spacing.md,
    minHeight: minTouchTargetPx,
  },
  sheetOptionText: { flex: 1, gap: 2, minWidth: 0 },
  sheetOptionLabel: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  sheetOptionDescription: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: mobileBrand[500],
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: mobileBrand[500],
  },
  statusBanner: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: tennisColors.secondary,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
  },
  statusBannerTitle: {
    fontSize: typography.size.md,
    fontFamily: tennisFontFamily.headingSemi,
  },
  statusBannerBody: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    fontFamily: tennisFontFamily.body,
    opacity: 0.92,
  },
  statusBannerActions: { gap: spacing.sm, marginTop: spacing.xs },
  formSection: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: semantic.surface,
    ...elevation.sm,
  },
  formSectionBody: {
    gap: spacing.md,
  },
  collapseMeasure: {
    position: "absolute",
    opacity: 0,
    left: 0,
    right: 0,
  },
  collapseContainer: {
    overflow: "hidden",
  },
  settingRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: minTouchTargetPx,
  },
  settingRowCard: {
    padding: 14,
    borderRadius: tennisRadii.lg,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
    marginBottom: 8,
  },
  settingText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  settingLabel: {
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  settingDescription: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
});
