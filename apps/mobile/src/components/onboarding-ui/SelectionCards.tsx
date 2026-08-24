import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { AppText } from "../AppText";
import { Icon, type IconName } from "../Icon";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import {
  tennisColors,
  tennisRadii,
  tennisTypography,
} from "../../theme/tennis-tokens";

export function PolicyToggleCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.card, selected ? styles.cardSelected : null]}
    >
      <View
        style={[styles.checkbox, selected ? styles.checkboxSelected : null]}
      >
        {selected ? <AppText style={styles.check}>✓</AppText> : null}
      </View>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

export function SelectionCard({
  label,
  description,
  selected,
  onPress,
  trailing,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  trailing?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.selection, selected ? styles.selectionSelected : null]}
    >
      {selected ? (
        <View style={styles.dot} />
      ) : (
        <View style={[styles.dot, styles.dotIdle]} />
      )}
      <View style={styles.selectionBody}>
        <AppText
          style={[
            styles.selectionLabel,
            selected ? styles.selectionLabelSelected : null,
          ]}
        >
          {label}
        </AppText>
        {description ? (
          <AppText
            style={[
              styles.selectionDesc,
              selected ? styles.selectionDescSelected : null,
            ]}
          >
            {description}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <AppText
          style={[styles.trailing, selected ? styles.trailingSelected : null]}
        >
          {trailing}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function ChipButton({
  label,
  selected,
  onPress,
  disabled = false,
  compact = false,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Announces the chip as unavailable rather than leaving it a button that does nothing. */
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        selected ? styles.chipSelected : null,
        style,
      ]}
    >
      <AppText
        style={[
          styles.chipLabel,
          compact && styles.chipLabelCompact,
          selected ? styles.chipLabelSelected : null,
        ]}
        maxLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Icon name={icon} size={20} color={tennisColors.primary} />
      </View>
      <View style={styles.benefitBody}>
        <AppText style={styles.benefitTitle}>{title}</AppText>
        <AppText style={styles.benefitDesc}>{description}</AppText>
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 16,
      borderRadius: tennisRadii.lg,
      borderWidth: 2,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      marginBottom: 12,
    },
    cardSelected: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisColors.secondary,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      backgroundColor: tennisColors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: {
      backgroundColor: tennisColors.primary,
    },
    check: {
      color: tennisColors.lime,
      fontSize: 12,
      fontFamily: tennisFontFamily.bodySemi,
    },
    label: {
      flex: 1,
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      color: tennisColors.primaryDark,
    },
    selection: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: 16,
      borderRadius: tennisRadii.lg,
      borderWidth: 2,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      marginBottom: 10,
    },
    selectionSelected: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisColors.primary,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: tennisColors.lime,
    },
    dotIdle: {
      backgroundColor: tennisColors.accent,
    },
    selectionBody: {
      flex: 1,
    },
    selectionLabel: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 16,
      color: tennisColors.primaryDark,
    },
    selectionLabelSelected: {
      color: tennisColors.white,
    },
    selectionDesc: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.sectionSubtitle.fontSize,
      lineHeight: tennisTypography.sectionSubtitle.lineHeight,
      color: tennisColors.mutedForeground,
      marginTop: 1,
    },
    selectionDescSelected: {
      color: "rgba(255,255,255,0.7)",
    },
    trailing: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 12,
      color: tennisColors.mutedForeground,
    },
    trailingSelected: {
      color: "rgba(255,255,255,0.6)",
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: tennisRadii.pill,
      borderWidth: 2,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      marginRight: 8,
      marginBottom: 8,
    },
    chipSelected: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisColors.primary,
    },
    chipCompact: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      marginRight: 0,
      marginBottom: 0,
      borderWidth: 1.5,
      minHeight: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    chipLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.primaryDark,
    },
    chipLabelCompact: {
      fontSize: 11,
      lineHeight: 14,
    },
    chipLabelSelected: {
      color: tennisColors.white,
    },
    benefit: {
      flexDirection: "row",
      gap: 14,
      padding: 16,
      borderRadius: tennisRadii.lg,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      marginBottom: 12,
    },
    benefitIcon: {
      width: 40,
      height: 40,
      borderRadius: tennisRadii.md,
      backgroundColor: tennisColors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    benefitIconText: {
      fontSize: 20,
    },
    benefitBody: {
      flex: 1,
    },
    benefitTitle: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 15,
      color: tennisColors.primaryDark,
      marginBottom: 2,
    },
    benefitDesc: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.sectionSubtitle.fontSize,
      lineHeight: tennisTypography.sectionSubtitle.lineHeight,
      color: tennisColors.mutedForeground,
    },
  }),
);
