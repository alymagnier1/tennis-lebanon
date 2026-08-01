import type { TFunction } from "i18next";

export function formatAvailabilitySectionLabel(
  mode: "recurring" | "oneOff",
  count: number,
  t: TFunction,
): string {
  if (mode === "recurring") {
    return count === 1
      ? t("availability.selectedCount", { count })
      : t("availability.selectedCount_other", { count });
  }

  return count === 1
    ? t("availability.oneOffCount_one")
    : t("availability.oneOffCount_other", { count });
}
