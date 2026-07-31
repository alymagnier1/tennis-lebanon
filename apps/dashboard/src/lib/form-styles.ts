import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import type { CSSProperties } from "react";

export const fieldStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: radii.sm,
  border: `1px solid ${colors.neutral[100]}`,
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: typography.size.md,
  width: "100%",
};

export const labelStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.xs,
};

export const cardStyle: CSSProperties = {
  background: colors.neutral[0],
  border: `1px solid ${colors.neutral[100]}`,
  borderRadius: radii.md,
  padding: spacing.lg,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

export const primaryButtonStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: radii.sm,
  border: "none",
  background: colors.brand[600],
  color: colors.neutral[0],
  padding: `${spacing.sm}px ${spacing.lg}px`,
  cursor: "pointer",
  fontWeight: typography.weight.semibold,
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: colors.neutral[0],
  color: colors.neutral[700],
  border: `1px solid ${colors.neutral[100]}`,
};

export const dangerButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: colors.danger[500],
};

export const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

export const AMENITY_OPTIONS = [
  "parking",
  "showers",
  "pay_as_you_play",
  "cafe",
  "pro_shop",
] as const;

export const SURFACE_OPTIONS = [
  "hard",
  "clay",
  "grass",
  "carpet",
  "other",
] as const;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function zoneLabel(
  nameI18n: Record<string, string> | null | undefined,
  slug: string,
): string {
  return nameI18n?.en ?? nameI18n?.fr ?? slug;
}
