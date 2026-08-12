import { StyleSheet } from "react-native";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export const hubSectionStyles = StyleSheet.create({
  root: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: tennisColors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  primaryLine: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 20,
    lineHeight: 26,
    color: tennisColors.primaryDark,
    letterSpacing: -0.3,
  },
  secondaryLine: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 17,
    lineHeight: 22,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
  metaLine: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
  noteLine: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: tennisColors.mutedForeground,
  },
});
