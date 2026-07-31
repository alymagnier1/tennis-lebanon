"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listPendingClubs,
  reviewPilotClub,
  type PendingClub,
} from "@tennis-lebanon/api";
import { colors, radii, spacing } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import {
  fieldStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/lib/form-styles";
import { formatBeirutDateTime } from "@/lib/beirut-time";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

/**
 * Platform-operator review queue. Clubs self-register but stay invisible to
 * players until approved here, so a fake club cannot reach the directory or
 * redirect bookings to an attacker-controlled contact (SEC-001).
 */
export function PendingClubsQueue() {
  const { t } = useTranslation();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<PendingClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonByClub, setReasonByClub] = useState<Record<string, string>>({});
  const [actingClubId, setActingClubId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setError(null);
        const nextRows = await listPendingClubs(client);
        if (!cancelled) {
          setRows(nextRows);
        }
      } catch {
        if (!cancelled) {
          setError(t("dashboard.pendingClubs.loadError"));
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

  const handleReview = async (row: PendingClub, approve: boolean) => {
    const reason = reasonByClub[row.club_id]?.trim() ?? "";

    // Rejection is the destructive branch, so it must be explained.
    if (!approve && reason.length < 3) {
      setError(t("dashboard.pendingClubs.reasonRequired"));
      return;
    }

    setActingClubId(row.club_id);
    setError(null);
    try {
      await reviewPilotClub(client, row.club_id, approve, reason || undefined);
      setReasonByClub((current) => {
        const next = { ...current };
        delete next[row.club_id];
        return next;
      });
      setRows(await listPendingClubs(client));
    } catch {
      setError(t("dashboard.pendingClubs.actionError"));
    } finally {
      setActingClubId(null);
    }
  };

  return (
    <DashboardShell title={t("dashboard.pendingClubs.title")}>
      <p style={{ margin: 0, color: colors.neutral[500] }}>
        {t("dashboard.pendingClubs.description")}
      </p>

      {error ? (
        <p role="alert" style={{ margin: 0, color: colors.danger[700] }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: colors.neutral[500] }}>
          {t("dashboard.pendingClubs.loading")}
        </p>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p style={{ color: colors.neutral[500] }}>
          {t("dashboard.pendingClubs.empty")}
        </p>
      ) : null}

      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        {rows.map((row) => (
          <article
            key={row.club_id}
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
              <strong style={{ color: colors.neutral[900] }}>{row.name}</strong>
              <p
                style={{
                  margin: `${spacing.xs}px 0 0`,
                  color: colors.neutral[500],
                }}
              >
                {t("dashboard.pendingClubs.meta", {
                  zone: row.zone_slug,
                  courts: row.court_count,
                })}
              </p>
              <p
                style={{
                  margin: `${spacing.xs}px 0 0`,
                  color: colors.neutral[500],
                }}
              >
                {t("dashboard.pendingClubs.submittedBy", {
                  name:
                    row.admin_display_name ??
                    t("dashboard.pendingClubs.unknownAdmin"),
                  date: formatBeirutDateTime(row.submitted_at),
                })}
              </p>
            </div>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.xs,
                color: colors.neutral[700],
              }}
            >
              {t("dashboard.pendingClubs.reasonLabel")}
              <input
                type="text"
                value={reasonByClub[row.club_id] ?? ""}
                onChange={(event) =>
                  setReasonByClub((current) => ({
                    ...current,
                    [row.club_id]: event.target.value,
                  }))
                }
                placeholder={t("dashboard.pendingClubs.reasonPlaceholder")}
                style={fieldStyle}
              />
            </label>

            <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
              <button
                type="button"
                style={primaryButtonStyle}
                disabled={actingClubId === row.club_id}
                onClick={() => void handleReview(row, true)}
              >
                {t("dashboard.pendingClubs.approve")}
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                disabled={actingClubId === row.club_id}
                onClick={() => void handleReview(row, false)}
              >
                {t("dashboard.pendingClubs.reject")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
