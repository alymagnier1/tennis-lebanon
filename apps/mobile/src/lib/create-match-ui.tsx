import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import type { PropsWithChildren, ReactNode } from "react";
import { AppText } from "../components/AppText";
import { Icon } from "../components/Icon";
import { figmaFormStyles } from "../components/onboarding-ui/figma-form-styles";
import { useLayoutDirection } from "./layout-direction";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import {
  tennisColors,
  tennisRadii,
  tennisTypography,
} from "../theme/tennis-tokens";
import { tennisTextStyles } from "../theme/tennis-text-styles";

export function CreateMatchPanel({
  title,
  description,
  actionLabel,
  onAction,
  onInfo,
  infoAccessibilityLabel,
  children,
}: PropsWithChildren<{
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional info control in the header (e.g. skill-band blurbs). */
  onInfo?: () => void;
  infoAccessibilityLabel?: string;
}>) {
  const { rowDirection } = useLayoutDirection();

  return (
    <View style={createMatchPanelStyles.panel}>
      <View style={createMatchPanelStyles.panelHeaderBlock}>
        <View
          style={[
            createMatchPanelStyles.panelHeader,
            { flexDirection: rowDirection },
          ]}
        >
          <AppText
            accessibilityRole="header"
            style={createMatchPanelStyles.panelTitle}
          >
            {title}
          </AppText>
          <View
            style={[
              createMatchPanelStyles.panelHeaderActions,
              { flexDirection: rowDirection },
            ]}
          >
            {onInfo ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={infoAccessibilityLabel}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={onInfo}
                style={createMatchPanelStyles.panelInfoButton}
              >
                <Icon
                  name="info"
                  size={22}
                  color={tennisColors.mutedForeground}
                />
              </Pressable>
            ) : null}
            {actionLabel && onAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                hitSlop={8}
                onPress={onAction}
              >
                <AppText style={createMatchPanelStyles.panelAction}>
                  {actionLabel}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
        {description ? (
          <AppText style={tennisTextStyles.sectionSubtitle}>
            {description}
          </AppText>
        ) : null}
      </View>
      {children ? (
        <View
          style={[
            createMatchPanelStyles.panelBody,
            description
              ? createMatchPanelStyles.panelBodyAfterSubtitle
              : createMatchPanelStyles.panelBodyAfterTitle,
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function CreateMatchSection({
  label,
  description,
  children,
}: PropsWithChildren<{
  label: string;
  description?: string;
  showDivider?: boolean;
}>) {
  return (
    <View>
      <AppText style={figmaFormStyles.fieldLabel}>{label}</AppText>
      {description ? (
        <AppText style={tennisTextStyles.fieldHint}>{description}</AppText>
      ) : null}
      {children}
    </View>
  );
}

export function CreateMatchSubsection({
  label,
  hint,
  children,
}: PropsWithChildren<{
  label: string;
  /** Quiet copy on the same row as the label (trailing). */
  hint?: string;
}>) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View style={createMatchPanelStyles.subsection}>
      <View
        style={[
          createMatchPanelStyles.subsectionHeader,
          { flexDirection: rowDirection },
        ]}
      >
        <AppText style={createMatchPanelStyles.subsectionLabel}>
          {label}
        </AppText>
        {hint ? (
          <AppText
            style={[
              createMatchPanelStyles.subsectionHint,
              { writingDirection },
            ]}
            maxLines={2}
          >
            {hint}
          </AppText>
        ) : null}
      </View>
      <View style={createMatchPanelStyles.subsectionBody}>{children}</View>
    </View>
  );
}

export function CreateMatchSubsectionDivider() {
  return <View style={createMatchPanelStyles.subsectionDivider} />;
}

export function CreateMatchSummaryValue({
  children,
  empty,
}: {
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <View
      style={[
        createMatchPanelStyles.summaryValueWrap,
        empty && createMatchPanelStyles.summaryValueEmpty,
      ]}
    >
      {children}
    </View>
  );
}

const createMatchPanelStyles = createLiveSheet(() =>
  StyleSheet.create({
    panel: {
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.xl,
      padding: 16,
    },
    panelHeaderBlock: {
      gap: tennisTypography.titleSubtitleGap,
    },
    panelHeader: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    panelTitle: {
      flex: 1,
      fontFamily: tennisFontFamily.heading,
      fontSize: 17,
      lineHeight: 20,
      color: tennisColors.primaryDark,
      letterSpacing: -0.3,
    },
    panelAction: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.primary,
    },
    panelHeaderActions: {
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    },
    panelInfoButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    panelBody: {
      gap: 12,
    },
    panelBodyAfterTitle: {
      // Match panel padding so space above the title equals space below it.
      marginTop: 16,
    },
    panelBodyAfterSubtitle: {
      marginTop: 16,
    },
    subsection: {
      gap: 8,
    },
    subsectionHeader: {
      alignItems: "baseline",
      gap: 8,
    },
    subsectionLabel: {
      flexShrink: 0,
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
      letterSpacing: 0.2,
    },
    subsectionHint: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    subsectionBody: {
      gap: 8,
    },
    subsectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: tennisColors.border,
      marginVertical: 4,
    },
    summaryValueWrap: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: tennisRadii.md,
      backgroundColor: tennisColors.muted,
    },
    summaryValueEmpty: {
      backgroundColor: tennisColors.background,
      borderWidth: 1,
      borderColor: tennisColors.border,
    },
  }),
);

export { createMatchStyles } from "./create-match-styles";
