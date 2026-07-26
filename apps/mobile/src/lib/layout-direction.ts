import { useTranslation } from "react-i18next";
import {
  getTextDirection,
  isSupportedLocale,
  type SupportedLocale,
} from "@tennis-lebanon/i18n";

export function resolveLocale(language: string): SupportedLocale {
  const base = language.split("-")[0] ?? language;
  return isSupportedLocale(base) ? base : "en";
}

export function useLayoutDirection() {
  const { i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const writingDirection = getTextDirection(locale);
  const isRtl = writingDirection === "rtl";

  return {
    locale,
    isRtl,
    writingDirection,
    rowDirection: isRtl ? ("row-reverse" as const) : ("row" as const),
    chevron: isRtl ? "‹" : "›",
  };
}
