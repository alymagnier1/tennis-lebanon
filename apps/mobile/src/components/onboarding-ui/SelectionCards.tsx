import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { AppText } from "../AppText";
import { Icon, type IconName } from "../Icon";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  tennisColors,
  tennisRadii,
  tennisSemantic,
  tennisSkillBands,
  tennisTypography,
} from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";

const BAND_ORDER = [
  "beginner",
  "improving",
  "intermediate",
  "advanced",
  "competitive",
] as const;

const METER_HEIGHTS = [6, 10, 14, 18, 22];

export function PolicyToggleCard({
  label,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        selected ? styles.cardSelected : null,
      ]}
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

export function PolicyDocumentList({
  items,
}: {
  items: { key: string; label: string; onPress: () => void }[];
}) {
  const { isRtl } = useLayoutDirection();
  return (
    <View style={styles.docCard}>
      {items.map((item, index) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={item.onPress}
          style={({ pressed }) => [
            styles.docRow,
            index < items.length - 1 ? styles.docRowDivider : null,
            pressed ? styles.docRowPressed : null,
          ]}
        >
          <AppText style={[tennisTextStyles.rowLabel, styles.docLabel]}>
            {item.label}
          </AppText>
          <AppText
            style={[styles.docChevron, isRtl ? styles.docChevronRtl : null]}
          >
            ›
          </AppText>
        </Pressable>
      ))}
    </View>
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

export function SkillBandCard({
  band,
  label,
  description,
  selected,
  onPress,
}: {
  band: (typeof BAND_ORDER)[number];
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = tennisSkillBands[band] ?? {
    fill: tennisColors.card,
    text: tennisColors.primaryDark,
  };
  const ordinal = BAND_ORDER.indexOf(band);
  const titleColor = selected ? palette.text : tennisColors.primaryDark;
  const descColor = selected
    ? withAlpha(palette.text, 0.72)
    : tennisColors.mutedForeground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.bandCard,
        selected
          ? { backgroundColor: palette.fill, borderColor: palette.text }
          : null,
      ]}
    >
      <BandMeter
        ordinal={ordinal}
        activeColor={palette.text}
        selected={selected}
      />
      <View style={styles.selectionBody}>
        <AppText style={[styles.bandTitle, { color: titleColor }]}>
          {label}
        </AppText>
        <AppText style={[styles.bandDesc, { color: descColor }]}>
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}

function BandMeter({
  ordinal,
  activeColor,
  selected,
}: {
  ordinal: number;
  activeColor: string;
  selected: boolean;
}) {
  return (
    <View style={styles.meter}>
      {METER_HEIGHTS.map((height, index) => {
        const filled = index <= ordinal;
        const color = filled
          ? activeColor
          : selected
            ? withAlpha(activeColor, 0.25)
            : tennisColors.border;
        return (
          <View
            key={height}
            style={[styles.meterBar, { height, backgroundColor: color }]}
          />
        );
      })}
    </View>
  );
}

export function ZoneChoiceCard({
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.zoneCard, selected ? styles.zoneCardSelected : null]}
    >
      <View
        pointerEvents="none"
        style={[styles.zoneRing, selected ? styles.zoneRingSelected : null]}
      />
      <View style={[styles.zoneBox, selected ? styles.zoneBoxSelected : null]}>
        {selected ? <AppText style={styles.zoneCheck}>✓</AppText> : null}
      </View>
      <View style={styles.selectionBody}>
        <AppText
          style={[
            tennisTextStyles.sectionTitle,
            selected ? styles.zoneTitleSelected : null,
          ]}
        >
          {label}
        </AppText>
        {description ? (
          <AppText
            style={[styles.zoneSub, selected ? styles.zoneSubSelected : null]}
          >
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function UpcomingZoneCard({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={`${label}. ${hint}`}
      style={styles.upcomingCard}
    >
      <AppText style={styles.upcomingName}>{label}</AppText>
      <AppText style={tennisTextStyles.fieldHint}>{hint}</AppText>
    </View>
  );
}

export function ChipButton({
  label,
  selected,
  onPress,
  disabled = false,
  compact = false,
  soft = false,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Announces the chip as unavailable rather than leaving it a button that does nothing. */
  disabled?: boolean;
  compact?: boolean;
  /** Onboarding chips: tinted fill instead of inverted primary. */
  soft?: boolean;
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
        selected
          ? soft
            ? styles.chipSoftSelected
            : styles.chipSelected
          : null,
        style,
      ]}
    >
      <AppText
        style={[
          styles.chipLabel,
          compact && styles.chipLabelCompact,
          selected
            ? soft
              ? styles.chipSoftLabelSelected
              : styles.chipLabelSelected
            : soft
              ? styles.chipSoftLabel
              : null,
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

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return color;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      padding: 18,
      borderRadius: tennisRadii.xl,
      borderWidth: 2,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      marginBottom: 12,
    },
    cardCompact: {
      padding: 16,
      alignItems: "center",
      marginBottom: 28,
    },
    cardSelected: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisSemantic.info.fill,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      backgroundColor: tennisColors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: {
      backgroundColor: tennisColors.primary,
    },
    check: {
      color: tennisColors.onPrimary,
      fontSize: 13,
      fontFamily: tennisFontFamily.bodySemi,
    },
    label: {
      flex: 1,
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13.5,
      lineHeight: 19,
      color: tennisColors.primaryDark,
    },
    docCard: {
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.xl,
      overflow: "hidden",
      marginBottom: 18,
    },
    docRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      minHeight: 52,
    },
    docRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tennisColors.border,
    },
    docRowPressed: {
      backgroundColor: tennisColors.muted,
    },
    docLabel: {
      flex: 1,
    },
    docChevron: {
      fontFamily: tennisFontFamily.body,
      fontSize: 17,
      color: tennisColors.mutedForeground,
    },
    docChevronRtl: {
      transform: [{ scaleX: -1 }],
    },
    bandCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 15,
      paddingHorizontal: 16,
      borderRadius: tennisRadii.lg,
      borderWidth: 2,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      marginBottom: 8,
    },
    bandTitle: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 14.5,
    },
    bandDesc: {
      fontFamily: tennisFontFamily.body,
      fontSize: 11.5,
      lineHeight: 15,
      marginTop: 2,
    },
    meter: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
      height: 22,
    },
    meterBar: {
      width: 4,
      borderRadius: 1,
    },
    zoneCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 20,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      marginBottom: 12,
      overflow: "hidden",
      position: "relative",
    },
    zoneCardSelected: {
      backgroundColor: tennisColors.primary,
      borderColor: tennisColors.primary,
    },
    zoneRing: {
      position: "absolute",
      width: 150,
      height: 150,
      borderRadius: 75,
      borderWidth: 18,
      borderColor: tennisColors.primary,
      opacity: 0.08,
      right: -30,
      top: -30,
    },
    zoneRingSelected: {
      borderColor: tennisColors.white,
      opacity: 0.1,
    },
    zoneBox: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: tennisColors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    zoneBoxSelected: {
      backgroundColor: tennisColors.lime,
    },
    zoneCheck: {
      color: tennisColors.limeText,
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
    },
    zoneTitleSelected: {
      color: tennisColors.white,
    },
    zoneSub: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.mutedForeground,
      marginTop: 2,
    },
    zoneSubSelected: {
      color: "rgba(255,255,255,0.7)",
    },
    upcomingCard: {
      flex: 1,
      padding: 16,
      borderRadius: tennisRadii.lg,
      backgroundColor: tennisColors.muted,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
    },
    upcomingName: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      color: tennisColors.mutedForeground,
      marginBottom: 2,
    },
    chipSoftSelected: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisSemantic.info.fill,
    },
    chipSoftLabel: {
      color: tennisColors.mutedForeground,
    },
    chipSoftLabelSelected: {
      color: tennisSemantic.info.text,
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
