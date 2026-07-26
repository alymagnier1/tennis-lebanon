"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  acceptBooking,
  getClubBookingDetail,
  proposeBookingAlternative,
  rejectBooking,
  type ClubBookingDetail,
  type ClubBookingDetailCourt,
} from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import { formatBeirutTimeRange } from "@/lib/beirut-time";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

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

export function BookingDetailPanel({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [detail, setDetail] = useState<ClubBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showAlternative, setShowAlternative] = useState(false);
  const [altCourtId, setAltCourtId] = useState("");
  const [altStart, setAltStart] = useState("");
  const [altEnd, setAltEnd] = useState("");
  const [altReason, setAltReason] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubBookingDetail(client, bookingId);
      setDetail(data);
      if (!altCourtId && data.courts[0]) {
        setAltCourtId(data.courts[0].court_id);
      }
      if (!altStart) {
        setAltStart(data.booking.starts_at);
        setAltEnd(data.booking.ends_at);
      }
    } catch {
      setError(t("dashboard.bookingDetail.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, client]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setActing(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      await load();
      if (successMessage !== t("dashboard.bookingDetail.alternativeSent")) {
        router.push("/bookings");
      }
    } catch {
      setError(t("dashboard.bookingDetail.actionError"));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell title={t("dashboard.bookingDetail.title")}>
        <p style={{ color: colors.neutral[500], margin: 0 }}>…</p>
      </DashboardShell>
    );
  }

  if (!detail) {
    return (
      <DashboardShell title={t("dashboard.bookingDetail.title")}>
        <p style={{ color: colors.danger[500], margin: 0 }} role="alert">
          {error ?? t("dashboard.bookingDetail.loadError")}
        </p>
        <Link href="/bookings" style={{ color: colors.brand[600] }}>
          ← {t("dashboard.nav.bookings")}
        </Link>
      </DashboardShell>
    );
  }

  const canAct = detail.booking.status === "requested";

  return (
    <DashboardShell title={t("dashboard.bookingDetail.title")}>
      <Link href="/bookings" style={{ color: colors.brand[600] }}>
        ← {t("dashboard.nav.bookings")}
      </Link>

      <section style={cardStyle}>
        <p style={{ margin: 0, color: colors.brand[700], fontWeight: typography.weight.semibold }}>
          {statusLabel(detail.booking.status, t)}
        </p>
        <p style={{ margin: `${spacing.sm}px 0 0`, color: colors.neutral[900] }}>
          {detail.club.name} · {detail.booking.court_name}
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, color: colors.neutral[700] }}>
          {formatBeirutTimeRange(detail.booking.starts_at, detail.booking.ends_at)}
        </p>
        <p style={{ margin: `${spacing.sm}px 0 0`, color: colors.neutral[700] }}>
          {t("dashboard.bookings.requester")}: {detail.requester.display_name}
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, color: colors.neutral[700] }}>
          {t("dashboard.bookingDetail.match")}: {detail.match.format} ({detail.match.status})
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, color: colors.neutral[700] }}>
          {t("dashboard.bookingDetail.payment")}: {t("dashboard.bookingDetail.payAtClub")}
        </p>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("dashboard.bookingDetail.participants")}</h2>
        <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.neutral[700] }}>
          {detail.participants.map((participant: ClubBookingDetail["participants"][number]) => (
            <li key={participant.user_id}>
              {participant.display_name}
              {participant.is_creator ? " (host)" : ""}
            </li>
          ))}
        </ul>
      </section>

      {detail.booking.status === "alternative_proposed" ? (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>{t("dashboard.bookingDetail.statusAlternative")}</h2>
          <p style={{ margin: 0, color: colors.neutral[700] }}>
            {detail.booking.proposed_court_name} ·{" "}
            {detail.booking.proposed_start_at && detail.booking.proposed_end_at
              ? formatBeirutTimeRange(
                  detail.booking.proposed_start_at,
                  detail.booking.proposed_end_at,
                )
              : ""}
          </p>
          {detail.booking.club_note ? (
            <p style={{ margin: `${spacing.sm}px 0 0`, color: colors.neutral[500] }}>
              {detail.booking.club_note}
            </p>
          ) : null}
        </section>
      ) : null}

      {message ? (
        <p style={{ margin: 0, color: colors.brand[700] }} role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p style={{ margin: 0, color: colors.danger[500] }} role="alert">
          {error}
        </p>
      ) : null}

      {canAct ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.md }}>
          <button
            type="button"
            disabled={acting}
            onClick={() =>
              void runAction(
                () => acceptBooking(client, bookingId),
                t("dashboard.bookingDetail.accepted"),
              )
            }
            style={primaryButtonStyle}
          >
            {t("dashboard.bookingDetail.accept")}
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => {
              setShowReject((value) => !value);
              setShowAlternative(false);
            }}
            style={secondaryButtonStyle}
          >
            {t("dashboard.bookingDetail.reject")}
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => {
              setShowAlternative((value) => !value);
              setShowReject(false);
            }}
            style={secondaryButtonStyle}
          >
            {t("dashboard.bookingDetail.proposeAlternative")}
          </button>
        </div>
      ) : null}

      {showReject ? (
        <section style={cardStyle}>
          <label style={labelStyle}>
            <span>{t("dashboard.bookingDetail.rejectReasonLabel")}</span>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              style={textAreaStyle}
            />
          </label>
          <button
            type="button"
            disabled={acting}
            onClick={() =>
              void runAction(
                () => rejectBooking(client, bookingId, rejectReason || undefined),
                t("dashboard.bookingDetail.rejected"),
              )
            }
            style={dangerButtonStyle}
          >
            {t("dashboard.bookingDetail.reject")}
          </button>
        </section>
      ) : null}

      {showAlternative ? (
        <section style={cardStyle}>
          <label style={labelStyle}>
            <span>{t("dashboard.bookingDetail.alternativeCourtLabel")}</span>
            <select
              value={altCourtId}
              onChange={(event) => setAltCourtId(event.target.value)}
              style={controlStyle}
            >
              {detail.courts.map((court: ClubBookingDetailCourt) => (
                <option key={court.court_id} value={court.court_id}>
                  {court.name}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            <span>{t("dashboard.bookingDetail.alternativeStartLabel")}</span>
            <input
              type="text"
              value={altStart}
              onChange={(event) => setAltStart(event.target.value)}
              style={controlStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>{t("dashboard.bookingDetail.alternativeEndLabel")}</span>
            <input
              type="text"
              value={altEnd}
              onChange={(event) => setAltEnd(event.target.value)}
              style={controlStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>{t("dashboard.bookingDetail.alternativeReasonLabel")}</span>
            <textarea
              value={altReason}
              onChange={(event) => setAltReason(event.target.value)}
              rows={3}
              style={textAreaStyle}
            />
          </label>
          <button
            type="button"
            disabled={acting || !altCourtId || !altStart || !altEnd}
            onClick={() =>
              void runAction(
                () =>
                  proposeBookingAlternative(
                    client,
                    bookingId,
                    altCourtId,
                    altStart,
                    altEnd,
                    altReason || undefined,
                  ),
                t("dashboard.bookingDetail.alternativeSent"),
              )
            }
            style={primaryButtonStyle}
          >
            {t("dashboard.bookingDetail.proposeAlternative")}
          </button>
        </section>
      ) : null}
    </DashboardShell>
  );
}

const cardStyle: CSSProperties = {
  background: colors.neutral[0],
  border: `1px solid ${colors.neutral[100]}`,
  borderRadius: radii.md,
  padding: spacing.lg,
};

const sectionTitleStyle: CSSProperties = {
  margin: `0 0 ${spacing.sm}px`,
  fontSize: typography.size.md,
  color: colors.neutral[900],
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.xs,
  marginBottom: spacing.md,
};

const controlStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: radii.sm,
  border: `1px solid ${colors.neutral[100]}`,
  padding: `${spacing.sm}px ${spacing.md}px`,
};

const textAreaStyle: CSSProperties = {
  ...controlStyle,
  minHeight: 88,
  resize: "vertical",
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: radii.sm,
  border: "none",
  background: colors.brand[600],
  color: colors.neutral[0],
  padding: `${spacing.sm}px ${spacing.lg}px`,
  cursor: "pointer",
  fontWeight: typography.weight.semibold,
};

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: colors.neutral[0],
  color: colors.neutral[700],
  border: `1px solid ${colors.neutral[100]}`,
};

const dangerButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: colors.danger[500],
};
