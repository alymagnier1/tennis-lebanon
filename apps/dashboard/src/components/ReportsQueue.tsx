"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listOpenUserReports,
  resolveUserReport,
  type UserReportQueueRow,
} from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import {
  fieldStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/lib/form-styles";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

export function ReportsQueue() {
  const { t } = useTranslation();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<UserReportQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonByReport, setReasonByReport] = useState<Record<string, string>>({});
  const [actingReportId, setActingReportId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setError(null);
        const nextRows = await listOpenUserReports(client);
        if (!cancelled) {
          setRows(nextRows);
        }
      } catch {
        if (!cancelled) {
          setError(t("dashboard.reports.loadError"));
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

  const handleResolve = async (
    row: UserReportQueueRow,
    resolution: "dismiss" | "resolve",
  ) => {
    const reason = reasonByReport[row.report_id]?.trim() ?? "";
    if (reason.length < 3) {
      setError(t("dashboard.reports.reasonRequired"));
      return;
    }

    setActingReportId(row.report_id);
    setError(null);
    try {
      await resolveUserReport(client, row.report_id, resolution, reason);
      setReasonByReport((current) => {
        const next = { ...current };
        delete next[row.report_id];
        return next;
      });
      const nextRows = await listOpenUserReports(client);
      setRows(nextRows);
    } catch {
      setError(t("dashboard.reports.actionError"));
    } finally {
      setActingReportId(null);
    }
  };

  return (
    <DashboardShell title={t("dashboard.reports.title")}>
      <p style={{ margin: 0, color: colors.neutral[500] }}>
        {t("dashboard.reports.description")}
      </p>

      {error ? (
        <p role="alert" style={{ margin: 0, color: colors.danger[700] }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: colors.neutral[500] }}>{t("dashboard.reports.loading")}</p>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p style={{ color: colors.neutral[500] }}>{t("dashboard.reports.empty")}</p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        {rows.map((row) => (
          <article
            key={row.report_id}
            style={{
              background: colors.neutral[0],
              border: `1px solid ${colors.neutral[100]}`,
              borderRadius: radii.md,
              padding: spacing.lg,
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            <div>
              <strong style={{ color: colors.neutral[900] }}>
                {t(`reports.categories.${row.category}`)}
              </strong>
              <p style={{ margin: `${spacing.xs}px 0 0`, color: colors.neutral[500] }}>
                {t("dashboard.reports.reportedBy", { name: row.reporter_name })}
                {row.reported_user_name
                  ? ` · ${t("dashboard.reports.reportedUser", { name: row.reported_user_name })}`
                  : ""}
              </p>
              {row.note ? (
                <p style={{ margin: `${spacing.sm}px 0 0`, color: colors.neutral[700] }}>
                  {t("dashboard.reports.note", { note: row.note })}
                </p>
              ) : null}
              {row.match_id ? (
                <p style={{ margin: `${spacing.xs}px 0 0`, color: colors.neutral[500] }}>
                  {t("dashboard.reports.matchId", { id: row.match_id })}
                </p>
              ) : null}
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
              <span style={{ color: colors.neutral[700], fontSize: typography.size.sm }}>
                {t("dashboard.reports.reasonLabel")}
              </span>
              <textarea
                value={reasonByReport[row.report_id] ?? ""}
                onChange={(event) =>
                  setReasonByReport((current) => ({
                    ...current,
                    [row.report_id]: event.target.value,
                  }))
                }
                rows={3}
                style={fieldStyle}
              />
            </label>

            <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
              <button
                type="button"
                style={primaryButtonStyle}
                disabled={actingReportId === row.report_id}
                onClick={() => void handleResolve(row, "resolve")}
              >
                {t("dashboard.reports.markResolved")}
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                disabled={actingReportId === row.report_id}
                onClick={() => void handleResolve(row, "dismiss")}
              >
                {t("dashboard.reports.dismiss")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
