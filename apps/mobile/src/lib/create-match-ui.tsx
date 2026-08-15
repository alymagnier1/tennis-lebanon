import { Pressable, StyleSheet, View } from "react-native";
import type { PropsWithChildren, ReactNode } from "react";
import { AppText } from "../components/AppText";
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
  children,
}: PropsWithChildren<{
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
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
  children,
}: PropsWithChildren<{
  label: string;
}>) {
  return (
    <View style={createMatchPanelStyles.subsection}>
      <AppText style={createMatchPanelStyles.subsectionLabel}>{label}</AppText>
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

const createMatchPanelStyles = StyleSheet.create({
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
  panelBody: {
    gap: 12,
  },
  panelBodyAfterTitle: {
    marginTop: 8,
  },
  panelBodyAfterSubtitle: {
    marginTop: 10,
  },
  subsection: {
    gap: 4,
  },
  subsectionLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 11,
    lineHeight: 15,
    color: tennisColors.mutedForeground,
  },
  subsectionBody: {
    gap: 8,
  },
  subsectionDivider: {
    height: 1,
    backgroundColor: tennisColors.border,
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
});

export { createMatchStyles } from "./create-match-styles";
