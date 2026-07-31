"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/providers/AuthProvider";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";

export function DashboardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const isOperator = usePlatformOperator();

  return (
    <div style={{ minHeight: "100vh", background: colors.neutral[50] }}>
      <header
        style={{
          background: colors.neutral[0],
          borderBottom: `1px solid ${colors.neutral[100]}`,
          padding: `${spacing.md}px ${spacing.xl}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.lg,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.lg }}>
          <strong
            style={{ fontSize: typography.size.md, color: colors.neutral[900] }}
          >
            Tennis Lebanon
          </strong>
          <nav style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
            <Link
              href="/bookings"
              style={{ color: colors.brand[600], textDecoration: "none" }}
            >
              {t("dashboard.nav.bookings")}
            </Link>
            <Link
              href="/settings"
              style={{ color: colors.brand[600], textDecoration: "none" }}
            >
              {t("dashboard.nav.settings")}
            </Link>
            <Link
              href="/courts"
              style={{ color: colors.brand[600], textDecoration: "none" }}
            >
              {t("dashboard.nav.courts")}
            </Link>
            <Link
              href="/hours"
              style={{ color: colors.brand[600], textDecoration: "none" }}
            >
              {t("dashboard.nav.hours")}
            </Link>
            {isOperator ? (
              <>
                <Link
                  href="/admin/disputes"
                  style={{ color: colors.danger[700], textDecoration: "none" }}
                >
                  {t("dashboard.nav.disputes")}
                </Link>
                <Link
                  href="/admin/reports"
                  style={{ color: colors.danger[700], textDecoration: "none" }}
                >
                  {t("dashboard.nav.reports")}
                </Link>
              </>
            ) : null}
            <Link
              href="/onboarding"
              style={{ color: colors.brand[600], textDecoration: "none" }}
            >
              {t("dashboard.nav.onboarding")}
            </Link>
          </nav>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          style={{
            border: `1px solid ${colors.neutral[100]}`,
            background: colors.neutral[0],
            borderRadius: radii.sm,
            padding: `${spacing.sm}px ${spacing.md}px`,
            cursor: "pointer",
            minHeight: 44,
          }}
        >
          {t("dashboard.nav.signOut")}
        </button>
      </header>
      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: spacing.xl,
          display: "flex",
          flexDirection: "column",
          gap: spacing.lg,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: typography.size.xl,
            color: colors.neutral[900],
          }}
        >
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}
