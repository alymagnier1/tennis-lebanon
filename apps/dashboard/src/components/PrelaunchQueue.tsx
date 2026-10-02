"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listPrelaunchSignups,
  type PrelaunchSignupRow,
} from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import { formatBeirutDateTime } from "@/lib/beirut-time";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

const SLOTS = ["wd-am", "wd-pm", "wd-ev", "we-am", "we-pm", "we-ev"] as const;

export function PrelaunchQueue() {
  const { t } = useTranslation();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<PrelaunchSignupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setError(null);
        const nextRows = await listPrelaunchSignups(client);
        if (!cancelled) {
          setRows(nextRows);
        }
      } catch {
        if (!cancelled) {
          setError(t("dashboard.prelaunch.loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, t]);

  return (
    <DashboardShell title={t("dashboard.prelaunch.title")}>
      <p style={{ margin: 0, color: colors.neutral[500] }}>
        {t("dashboard.prelaunch.description")}
      </p>

      {error ? (
        <p role="alert" style={{ margin: 0, color: colors.danger[700] }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: colors.neutral[500] }}>
          {t("dashboard.prelaunch.loading")}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p style={{ color: colors.neutral[500] }}>
          {t("dashboard.prelaunch.empty")}
        </p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: colors.neutral[0],
              border: `1px solid ${colors.neutral[100]}`,
              borderRadius: radii.md,
              fontSize: typography.size.sm,
            }}
          >
            <thead>
              <tr>
                {(
                  [
                    "name",
                    "contact",
                    "level",
                    "court",
                    "times",
                    "status",
                    "joined",
                  ] as const
                ).map((column) => (
                  <th
                    key={column}
                    style={{
                      textAlign: "start",
                      padding: spacing.md,
                      borderBottom: `1px solid ${colors.neutral[100]}`,
                      color: colors.neutral[500],
                      fontWeight: 500,
                    }}
                  >
                    {t(`dashboard.prelaunch.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={cell}>{row.first_name}</td>
                  <td style={cell}>{row.contact}</td>
                  <td style={cell}>{t(`skillBands.${row.level}`)}</td>
                  <td style={cell}>{row.court ?? "—"}</td>
                  <td style={cell}>
                    {row.availability
                      .filter((slot): slot is (typeof SLOTS)[number] =>
                        (SLOTS as readonly string[]).includes(slot),
                      )
                      .map((slot) => t(`dashboard.prelaunch.slots.${slot}`))
                      .join(", ")}
                  </td>
                  <td style={cell}>
                    {t(`dashboard.prelaunch.statuses.${row.status}`)}
                  </td>
                  <td style={cell}>{formatBeirutDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </DashboardShell>
  );
}

const cell = {
  padding: spacing.md,
  borderBottom: `1px solid ${colors.neutral[100]}`,
  verticalAlign: "top" as const,
  color: colors.neutral[900],
};
