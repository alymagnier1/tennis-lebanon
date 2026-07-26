"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  listClubBookingRequests,
  listStaffClubs,
  type ClubBookingQueueRow,
  type StaffClub,
} from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import { formatBeirutTimeRange } from "@/lib/beirut-time";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

const PENDING_STATUSES = ["requested", "alternative_proposed"] as const;
const ALL_STATUSES = [
  "requested",
  "alternative_proposed",
  "accepted",
  "rejected",
  "cancelled",
] as const;

function statusLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case "requested":
      return t("dashboard.bookingDetail.statusRequested");
    case "alternative_proposed":
      return t("dashboard.bookingDetail.statusAlternative");
    case "accepted":
      return t("dashboard.bookingDetail.statusAccepted");
    case "rejected":
      return t("dashboard.bookingDetail.statusRejected");
    case "cancelled":
      return t("dashboard.bookingDetail.statusCancelled");
    default:
      return status;
  }
}

export function BookingsQueue() {
  const { t } = useTranslation();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [clubs, setClubs] = useState<StaffClub[]>([]);
  const [clubId, setClubId] = useState<string>("");
  const [rows, setRows] = useState<ClubBookingQueueRow[]>([]);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const staffClubs = await listStaffClubs(client);
        if (cancelled) return;
        setClubs(staffClubs);
        if (staffClubs[0]) {
          setClubId(staffClubs[0].club_id);
        }
      } catch {
        if (!cancelled) {
          setError(t("dashboard.bookings.loadError"));
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

  useEffect(() => {
    if (!clubId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await listClubBookingRequests(client, clubId, {
          statuses: showAll ? [...ALL_STATUSES] : [...PENDING_STATUSES],
          search: search.trim() || undefined,
        });
        if (!cancelled) {
          setRows(data);
        }
      } catch {
        if (!cancelled) {
          setError(t("dashboard.bookings.loadError"));
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
  }, [client, clubId, search, showAll, t]);

  return (
    <DashboardShell title={t("dashboard.bookings.title")}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.md }}>
        {clubs.length > 1 ? (
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span>Club</span>
            <select
              value={clubId}
              onChange={(event) => setClubId(event.target.value)}
              style={controlStyle}
            >
              {clubs.map((club) => (
                <option key={club.club_id} value={club.club_id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
        ) : clubs[0] ? (
          <p style={{ margin: 0, color: colors.neutral[700] }}>{clubs[0].name}</p>
        ) : null}

        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs, flex: 1 }}>
          <span>{t("dashboard.bookings.searchPlaceholder")}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("dashboard.bookings.searchPlaceholder")}
            style={controlStyle}
          />
        </label>

        <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-end" }}>
          <button
            type="button"
            onClick={() => setShowAll(false)}
            style={filterButtonStyle(!showAll)}
          >
            {t("dashboard.bookings.filterPending")}
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={filterButtonStyle(showAll)}
          >
            {t("dashboard.bookings.filterAll")}
          </button>
        </div>
      </div>

      {error ? (
        <p style={{ color: colors.danger[500], margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: colors.neutral[500], margin: 0 }}>…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: colors.neutral[700], margin: 0 }}>
          {t("dashboard.bookings.empty")}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
          }}
        >
          {rows.map((row) => (
            <li
              key={row.booking_id}
              style={{
                background: colors.neutral[0],
                border: `1px solid ${colors.neutral[100]}`,
                borderRadius: radii.md,
                padding: spacing.lg,
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: spacing.md,
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ color: colors.neutral[900] }}>
                  {row.requester_name}
                </strong>
                <span style={{ color: colors.brand[700] }}>
                  {statusLabel(row.status, t)}
                </span>
              </div>
              <p style={{ margin: 0, color: colors.neutral[700] }}>
                {t("dashboard.bookings.court")}: {row.court_name}
              </p>
              <p style={{ margin: 0, color: colors.neutral[700] }}>
                {t("dashboard.bookings.scheduled")}:{" "}
                {formatBeirutTimeRange(row.starts_at, row.ends_at)}
              </p>
              <p style={{ margin: 0, color: colors.neutral[500], fontSize: typography.size.sm }}>
                {t("dashboard.bookings.format")}: {row.match_format} ·{" "}
                {t("dashboard.bookings.participants")}: {row.participant_count}
              </p>
              <Link
                href={`/bookings/${row.booking_id}`}
                style={{
                  alignSelf: "flex-start",
                  color: colors.brand[600],
                  fontWeight: typography.weight.medium,
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {t("dashboard.bookings.viewDetail")} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}

const controlStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: radii.sm,
  border: `1px solid ${colors.neutral[100]}`,
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: typography.size.md,
  minWidth: 200,
};

function filterButtonStyle(active: boolean): CSSProperties {
  return {
    minHeight: 44,
    borderRadius: radii.sm,
    border: `1px solid ${active ? colors.brand[600] : colors.neutral[100]}`,
    background: active ? colors.brand[50] : colors.neutral[0],
    color: active ? colors.brand[700] : colors.neutral[700],
    padding: `${spacing.sm}px ${spacing.md}px`,
    cursor: "pointer",
  };
}
