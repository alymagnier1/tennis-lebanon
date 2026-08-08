import { StyleSheet } from "react-native";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import {
  tennisColors,
  tennisRadii,
  tennisSpacing,
  tennisTypography,
} from "../../theme/tennis-tokens";

/** Figma create-match / form field tokens (CreateTab + shared-ui). */
export const figmaFormStyles = StyleSheet.create({
  stack: {
    gap: tennisSpacing.section,
  },
  fieldLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: tennisTypography.fieldLabel.fontSize,
    lineHeight: tennisTypography.fieldLabel.lineHeight,
    color: tennisColors.mutedForeground,
    marginBottom: tennisTypography.labelBodyGap,
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: tennisRadii.md,
    borderWidth: 2,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  chipSelected: {
    borderColor: tennisColors.primary,
    backgroundColor: tennisColors.secondary,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipWrapItem: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: tennisRadii.md,
    borderWidth: 2,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  chipText: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 13,
    color: tennisColors.primaryDark,
    textAlign: "center",
  },
  chipTextSelected: {
    color: tennisColors.primary,
  },
});
