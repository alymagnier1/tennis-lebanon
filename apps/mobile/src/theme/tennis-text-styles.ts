import { StyleSheet } from "react-native";
import { createLiveSheet } from "./create-live-sheet";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { tennisColors, tennisTypography } from "./tennis-tokens";

/**
 * Shared subtitle, hint, and title-block spacing for page and section headers.
 */
export const tennisTextStyles = createLiveSheet(() =>
  StyleSheet.create({
    titleSubtitleBlock: {
      gap: tennisTypography.titleSubtitleGap,
    },
    pageSubtitle: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.subtitle.fontSize,
      lineHeight: tennisTypography.subtitle.lineHeight,
      color: tennisColors.mutedForeground,
    },
    pageSubtitleOnDark: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.subtitle.fontSize,
      lineHeight: tennisTypography.subtitle.lineHeight,
      color: "rgba(255,255,255,0.75)",
    },
    sectionSubtitle: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.sectionSubtitle.fontSize,
      lineHeight: tennisTypography.sectionSubtitle.lineHeight,
      color: tennisColors.mutedForeground,
    },
    sectionSubtitleOnDark: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.sectionSubtitle.fontSize,
      lineHeight: tennisTypography.sectionSubtitle.lineHeight,
      color: "rgba(255,255,255,0.65)",
    },
    fieldLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: tennisTypography.fieldLabel.fontSize,
      lineHeight: tennisTypography.fieldLabel.lineHeight,
      color: tennisColors.mutedForeground,
      marginBottom: tennisTypography.labelBodyGap,
    },
    fieldHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.fieldHint.fontSize,
      lineHeight: tennisTypography.fieldHint.lineHeight,
      color: tennisColors.mutedForeground,
      marginBottom: tennisTypography.labelBodyGap,
      marginTop: 0,
    },
    heroDisplay: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 46,
      lineHeight: 46,
      letterSpacing: -2.1,
    },
    heroDisplayPlate: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 44,
      lineHeight: 44,
      letterSpacing: -2.0,
    },
    heroDisplayTall: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 56,
      lineHeight: 52,
      letterSpacing: -2.9,
    },
    screenTitle: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 29,
      lineHeight: 32,
      letterSpacing: -0.8,
      color: tennisColors.heroOnLight,
    },
    sectionTitle: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 19,
      lineHeight: 24,
      letterSpacing: -0.4,
      color: tennisColors.heroOnLight,
    },
    wordmark: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: -0.4,
    },
    buttonLabel: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: -0.2,
    },
    bodyLead: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14.5,
      lineHeight: 23,
    },
    bodyForm: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13.5,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
    rowLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.heroOnLight,
    },
    eyebrow: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: tennisColors.mutedForeground,
    },
    statusPill: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
  }),
);
