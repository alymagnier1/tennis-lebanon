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
  }),
);
