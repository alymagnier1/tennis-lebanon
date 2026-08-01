import type { PropsWithChildren, ReactNode } from "react";
import { memo, useEffect, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
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
import { initialsFromName, resolveAvatarUri } from "../lib/avatar-url";
import { buildCardAccessibilityLabel } from "../lib/card-accessibility";
import { useLayoutDirection } from "../lib/layout-direction";
import { useResponsiveLayout } from "../lib/responsive";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

export function SegmentTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View style={[styles.segmentTabs, { flexDirection: rowDirection }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segmentTab, selected && styles.segmentTabActive]}
          >
            <AppText
              style={[
                styles.segmentTabText,
                selected && styles.segmentTabTextActive,
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
    <View style={styles.sectionTitle}>
      <AppText
        accessibilityRole="header"
        style={[styles.sectionTitleText, { writingDirection }]}
        maxLines={2}
      >
        {title}
      </AppText>
      {subtitle ? (
        <AppText
          style={[styles.sectionSubtitle, { writingDirection }]}
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
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { writingDirection } = useLayoutDirection();
  const { narrow } = useResponsiveLayout();

  return (
    <View style={styles.chipSection}>
      <AppText style={[styles.chipSectionLabel, { writingDirection }]}>
        {label}
      </AppText>
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
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  const { writingDirection } = useLayoutDirection();
  const { narrow } = useResponsiveLayout();

  return (
    <View style={styles.chipSection}>
      <AppText style={[styles.chipSectionLabel, { writingDirection }]}>
        {label}
      </AppText>
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
}: {
  name: string;
  avatarPath?: string | null;
  size?: number;
}) {
  const uri = resolveAvatarUri(avatarPath ?? null);
  const dimension = { width: size, height: size, borderRadius: size / 2 };

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

export const MatchCard = memo(function MatchCard({
  title,
  subtitle,
  meta,
  note,
  badge,
  onPress,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  note?: string;
  badge?: string;
  onPress?: () => void;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();
  const accessibilityLabel = buildCardAccessibilityLabel([
    title,
    badge,
    subtitle,
    meta,
    note,
  ]);

  const content = (
    <>
      <View style={styles.matchCardBody}>
        <AppText
          style={[styles.matchCardTitle, { writingDirection }]}
          maxLines={1}
        >
          {title}
        </AppText>
        {badge ? (
          <AppText style={styles.matchCardBadge} maxLines={1}>
            {badge}
          </AppText>
        ) : null}
        <AppText
          style={[styles.matchCardSubtitle, { writingDirection }]}
          maxLines={2}
        >
          {subtitle}
        </AppText>
        {meta ? (
          <AppText
            style={[styles.matchCardMeta, { writingDirection }]}
            maxLines={2}
          >
            {meta}
          </AppText>
        ) : null}
        {note ? (
          <AppText
            style={[styles.matchCardNote, { writingDirection }]}
            maxLines={2}
          >
            {note}
          </AppText>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron" size={20} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.matchCard, { flexDirection: rowDirection }]}>
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
        styles.matchCard,
        { flexDirection: rowDirection },
        pressed && styles.playerCardPressed,
      ]}
    >
      {content}
    </Pressable>
  );
});

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.emptyState}>
      <AppText accessibilityElementsHidden style={styles.emptyIcon}>
        {icon ?? "🎾"}
      </AppText>
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
  const [rendered, setRendered] = useState(visible);
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));

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
      <View style={styles.sheetRoot}>
        <Animated.View style={[styles.sheetBackdrop, { opacity }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheetContainer,
            { opacity },
            {
              paddingHorizontal: Math.max(
                horizontalPadding,
                insets.left,
                insets.right,
              ),
              paddingBottom: Math.max(insets.bottom, spacing.xl),
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
            contentContainerStyle={styles.sheetContent}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </Animated.View>
      </View>
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

export function SettingToggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View style={[styles.settingRow, { flexDirection: rowDirection }]}>
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
          true: colors.brand[300],
        }}
        thumbColor={value ? colors.brand[500] : colors.neutral[0]}
      />
    </View>
  );
}

export function StatusBanner({
  title,
  body,
  actions,
}: {
  title?: string;
  body: string;
  actions?: ReactNode;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.statusBanner}>
      {title ? (
        <AppText
          style={[styles.statusBannerTitle, { writingDirection }]}
          maxLines={2}
        >
          {title}
        </AppText>
      ) : null}
      <AppText
        style={[styles.statusBannerBody, { writingDirection }]}
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
    backgroundColor: colors.neutral[50],
    borderRadius: radii.full,
    padding: spacing.xs,
  },
  segmentTab: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
  },
  segmentTabActive: {
    backgroundColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentTabText: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
  segmentTabTextActive: {
    color: colors.brand[600],
  },
  wizardProgress: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  wizardSegment: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[100],
  },
  wizardSegmentActive: {
    backgroundColor: colors.neutral[900],
  },
  sectionTitle: { gap: spacing.xs },
  sectionTitleText: {
    color: colors.neutral[900],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  sectionSubtitle: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
    lineHeight: 20,
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
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  chipText: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  chipTextSelected: {
    color: colors.brand[700],
    fontWeight: typography.weight.semibold,
  },
  avatarImage: {
    backgroundColor: colors.neutral[100],
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand[100],
  },
  avatarInitials: {
    color: colors.brand[700],
    fontWeight: typography.weight.bold,
  },
  playerCard: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: semantic.surface,
    // Lifted rather than hairline-outlined: a 1px near-white border on white
    // is what made every surface read as a flat box.
    ...elevation.sm,
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
    backgroundColor: colors.brand[50],
    color: colors.brand[700],
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
    backgroundColor: semantic.interactive,
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
    backgroundColor: semantic.surface,
    ...elevation.sm,
  },
  matchCardBody: { flex: 1, gap: spacing.xs, minWidth: 0 },
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
  emptyIcon: { fontSize: 56 },
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
    backgroundColor: colors.brand[50],
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
    color: colors.brand[600],
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
    borderColor: colors.brand[500],
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.brand[500],
  },
  statusBanner: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
  },
  statusBannerTitle: {
    color: colors.brand[700],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  statusBannerBody: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
    lineHeight: 20,
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
  settingRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: minTouchTargetPx,
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
