import { StyleSheet } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { spacing } from "@tennis-lebanon/ui";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import {
  tennisColors,
  tennisRadii,
  tennisSemantic,
  tennisTypography,
} from "../theme/tennis-tokens";

export const createMatchStyles = createLiveSheet(() =>
  StyleSheet.create({
    section: {
      gap: spacing.sm,
    },
    slotTitle: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    addSlot: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
      color: tennisColors.primary,
    },
    notesSection: {
      gap: 8,
    },
    notesInput: {
      minHeight: 96,
      textAlignVertical: "top",
    },
    hint: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.fieldHint.fontSize,
      lineHeight: tennisTypography.fieldHint.lineHeight,
      color: tennisColors.mutedForeground,
    },
    /** A hint the host should act on, not just read past. */
    hintAttention: {
      fontFamily: tennisFontFamily.body,
      fontSize: tennisTypography.fieldHint.fontSize,
      lineHeight: tennisTypography.fieldHint.lineHeight,
      color: tennisSemantic.attention.text,
    },
    summaryValue: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.primaryDark,
    },
    placeSummary: {
      gap: 2,
    },
    placeRow: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 1,
      minHeight: 22,
    },
    placeLabel: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    profileLinkWrap: {
      marginTop: 6,
      paddingVertical: 2,
    },
    profileLink: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
      textAlign: "center",
    },
    advancedCard: {
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.xl,
      overflow: "hidden",
    },
    advancedHeader: {
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 52,
    },
    advancedHeaderPressed: {
      opacity: 0.88,
    },
    advancedHeaderText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    advancedTitle: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 15,
      lineHeight: 20,
      color: tennisColors.primaryDark,
      letterSpacing: -0.2,
    },
    advancedSummary: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    advancedBody: {
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tennisColors.border,
      paddingTop: 12,
    },
  }),
);
