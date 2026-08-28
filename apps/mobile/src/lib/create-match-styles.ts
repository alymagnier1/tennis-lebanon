import { StyleSheet } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { spacing } from "@tennis-lebanon/ui";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import {
  tennisColors,
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
    profileLink: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
      textAlign: "center",
    },
  }),
);
