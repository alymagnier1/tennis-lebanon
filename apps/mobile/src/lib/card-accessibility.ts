export function buildCardAccessibilityLabel(
  parts: (string | null | undefined)[],
): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(", ");
}
