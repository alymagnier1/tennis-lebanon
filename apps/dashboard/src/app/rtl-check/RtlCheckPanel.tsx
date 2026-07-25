"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LOCALES,
  getTextDirection,
  type SupportedLocale,
} from "@tennis-lebanon/i18n";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";

/**
 * Milestone 0 visual RTL check for the dashboard. Sets `dir` on this
 * subtree only; full app-wide locale routing is a later milestone.
 */
export function RtlCheckPanel() {
  const { t, i18n } = useTranslation();
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const direction = getTextDirection(locale);

  const selectLocale = (next: SupportedLocale) => {
    setLocale(next);
    i18n.changeLanguage(next);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: spacing.xl,
        display: "flex",
        flexDirection: "column",
        gap: spacing.lg,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", gap: spacing.sm }}>
        {SUPPORTED_LOCALES.map((code) => (
          <button
            key={code}
            onClick={() => selectLocale(code)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: radii.full,
              border: "none",
              minWidth: 44,
              cursor: "pointer",
              background:
                locale === code ? colors.brand[500] : colors.neutral[100],
              color: locale === code ? colors.neutral[0] : colors.neutral[700],
              fontWeight: typography.weight.medium,
            }}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        dir={direction}
        lang={locale}
        style={{
          border: `1px solid ${colors.neutral[100]}`,
          borderRadius: radii.lg,
          padding: spacing.lg,
          display: "flex",
          flexDirection: "column",
          gap: spacing.sm,
        }}
      >
        <h1
          style={{
            fontSize: typography.size.lg,
            margin: 0,
            color: colors.neutral[900],
          }}
        >
          {t("rtlCheck.title")}
        </h1>
        <p style={{ margin: 0, color: colors.neutral[700] }}>
          {t("rtlCheck.description")}
        </p>
        <p style={{ margin: 0, color: colors.brand[700] }}>
          {t("rtlCheck.sampleSentence")}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: typography.size.xs,
            color: colors.neutral[500],
          }}
        >
          {t("rtlCheck.directionLabel")}: {direction}
        </p>
      </div>
    </main>
  );
}
