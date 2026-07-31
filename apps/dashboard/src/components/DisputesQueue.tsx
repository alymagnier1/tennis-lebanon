"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  formatDisputeScore,
  listDisputedResults,
  resolveMatchResultDispute,
  type DisputedResultQueueRow,
} from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import {
  fieldStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/lib/form-styles";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

export function DisputesQueue() {
  const { t } = useTranslation();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<DisputedResultQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonByResult, setReasonByResult] = useState<Record<string, string>>(
    {},
  );
  const [actingResultId, setActingResultId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setError(null);
        const nextRows = await listDisputedResults(client);
        if (!cancelled) {
          setRows(nextRows);
        }
      } catch {
        if (!cancelled) {
          setError(t("dashboard.disputes.loadError"));
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
    row: DisputedResultQueueRow,
    resolution: "confirm" | "void",
  ) => {
    const reason = reasonByResult[row.result_id]?.trim() ?? "";
    if (reason.length < 3) {
      setError(t("dashboard.disputes.reasonRequired"));
      return;
    }

    setActingResultId(row.result_id);
    setError(null);
    try {
      await resolveMatchResultDispute(
        client,
        row.result_id,
        resolution,
        reason,
      );
      setReasonByResult((current) => {
        const next = { ...current };
        delete next[row.result_id];
        return next;
      });
      const nextRows = await listDisputedResults(client);
      setRows(nextRows);
    } catch {
      setError(t("dashboard.disputes.actionError"));
    } finally {
      setActingResultId(null);
    }
  };

  return (
    <DashboardShell title={t("dashboard.disputes.title")}>
      <p style={{ margin: 0, color: colors.neutral[500] }}>
        {t("dashboard.disputes.description")}
      </p>

      {error ? (
        <p role="alert" style={{ margin: 0, color: colors.danger[700] }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: colors.neutral[500] }}>
          {t("dashboard.disputes.loading")}
        </p>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p style={{ color: colors.neutral[500] }}>
          {t("dashboard.disputes.empty")}
        </p>
      ) : null}

      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        {rows.map((row) => (
          <article
            key={row.result_id}
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
                {t(`formats.${row.match_format}`)} · {row.winner_name}
              </strong>
              <p
                style={{
                  margin: `${spacing.xs}px 0 0`,
                  color: colors.neutral[500],
                }}
              >
                {t("dashboard.disputes.submittedBy", {
                  name: row.submitted_by_name,
                })}
              </p>
              <p
                style={{
                  margin: `${spacing.xs}px 0 0`,
                  color: colors.neutral[500],
                }}
              >
                {t("dashboard.disputes.score", {
                  score: formatDisputeScore(row.score),
                })}
              </p>
              {row.dispute_note ? (
                <p
                  style={{
                    margin: `${spacing.xs}px 0 0`,
                    color: colors.neutral[500],
                  }}
                >
                  {t("dashboard.disputes.playerNote", {
                    note: row.dispute_note,
                  })}
                </p>
              ) : null}
              <p
                style={{
                  margin: `${spacing.xs}px 0 0`,
                  color: colors.neutral[500],
                }}
              >
                {t("dashboard.disputes.matchId", { id: row.match_id })}
              </p>
            </div>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.xs,
              }}
            >
              <span
                style={{
                  color: colors.neutral[700],
                  fontSize: typography.size.sm,
                }}
              >
                {t("dashboard.disputes.reasonLabel")}
              </span>
              <textarea
                value={reasonByResult[row.result_id] ?? ""}
                onChange={(event) =>
                  setReasonByResult((current) => ({
                    ...current,
                    [row.result_id]: event.target.value,
                  }))
                }
                rows={3}
                style={{
                  ...fieldStyle,
                  minHeight: 88,
                  resize: "vertical",
                }}
              />
            </label>

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={actingResultId === row.result_id}
                onClick={() => void handleResolve(row, "confirm")}
                style={primaryButtonStyle}
              >
                {t("dashboard.disputes.confirmSubmitted")}
              </button>
              <button
                type="button"
                disabled={actingResultId === row.result_id}
                onClick={() => void handleResolve(row, "void")}
                style={secondaryButtonStyle}
              >
                {t("dashboard.disputes.voidResult")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
