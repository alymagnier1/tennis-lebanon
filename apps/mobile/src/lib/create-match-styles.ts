import { StyleSheet } from "react-native";
import { spacing } from "@tennis-lebanon/ui";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { tennisColors } from "../theme/tennis-tokens";

export const createMatchStyles = StyleSheet.create({
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
});
