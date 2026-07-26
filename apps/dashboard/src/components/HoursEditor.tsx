"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createCourtBlock,
  deleteCourtBlock,
  getClubAdminDetail,
  setCourtWeeklyHours,
  type ClubAdminDetail,
  type CourtHour,
} from "@tennis-lebanon/api";
import { colors, spacing } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import { useStaffClubs } from "@/hooks/useStaffClubs";
import { formatBeirutTimeRange } from "@/lib/beirut-time";
import {
  WEEKDAYS,
  cardStyle,
  dangerButtonStyle,
  fieldStyle,
  labelStackStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/lib/form-styles";

function defaultHours(): CourtHour[] {
  return WEEKDAYS.map((day) => ({
    weekday: day.value,
    opens_at: "07:00:00",
    closes_at: "22:00:00",
  }));
}

export function HoursEditor() {
  const { t } = useTranslation();
  const { client, clubId, isAdmin, loading: clubsLoading } = useStaffClubs();
  const [detail, setDetail] = useState<ClubAdminDetail | null>(null);
  const [courtId, setCourtId] = useState("");
  const [hours, setHours] = useState<CourtHour[]>(defaultHours());
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!clubId) return;
    const data = await getClubAdminDetail(client, clubId);
    setDetail(data);
    if (!courtId && data.courts[0]) {
      setCourtId(data.courts[0].court_id);
      setHours(data.courts[0].hours.length ? data.courts[0].hours : defaultHours());
    }
  };

  useEffect(() => {
    if (!clubId || !isAdmin) return;
    void load();
  }, [client, clubId, isAdmin]);

  useEffect(() => {
    const court = detail?.courts.find((item) => item.court_id === courtId);
    if (court) {
      setHours(court.hours.length ? court.hours : defaultHours());
    }
  }, [courtId, detail]);

  const updateHour = (weekday: number, field: "opens_at" | "closes_at", value: string) => {
    setHours((current) =>
      current.map((hour) =>
        hour.weekday === weekday ? { ...hour, [field]: value.length === 5 ? `${value}:00` : value } : hour,
      ),
    );
  };

  const saveHours = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!courtId) return;
    setError(null);
    setMessage(null);
    try {
      await setCourtWeeklyHours(
        client,
        courtId,
        hours.map((hour) => ({
          weekday: hour.weekday,
          opensAt: hour.opens_at.slice(0, 5),
          closesAt: hour.closes_at.slice(0, 5),
        })),
      );
      setMessage(t("dashboard.hours.saved"));
      await load();
    } catch {
      setError(t("dashboard.hours.error"));
    }
  };

  const addBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!courtId || !blockStart || !blockEnd) return;
    setError(null);
    setMessage(null);
    try {
      await createCourtBlock(
        client,
        courtId,
        new Date(blockStart).toISOString(),
        new Date(blockEnd).toISOString(),
        blockReason || undefined,
      );
      setMessage(t("dashboard.hours.blockSaved"));
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      await load();
    } catch {
      setError(t("dashboard.hours.error"));
    }
  };

  const removeBlock = async (blockId: string) => {
    setError(null);
    try {
      await deleteCourtBlock(client, blockId);
      await load();
    } catch {
      setError(t("dashboard.hours.error"));
    }
  };

  if (clubsLoading) {
    return (
      <DashboardShell title={t("dashboard.hours.title")}>
        <p>…</p>
      </DashboardShell>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardShell title={t("dashboard.hours.title")}>
        <p style={{ color: colors.neutral[700] }}>{t("dashboard.settings.adminOnly")}</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t("dashboard.hours.title")}>
      <label style={labelStackStyle}>
        <span>{t("dashboard.hours.courtLabel")}</span>
        <select value={courtId} onChange={(e) => setCourtId(e.target.value)} style={fieldStyle}>
          {(detail?.courts ?? []).map((court) => (
            <option key={court.court_id} value={court.court_id}>
              {court.name}
            </option>
          ))}
        </select>
      </label>

      <form onSubmit={(event) => void saveHours(event)} style={cardStyle}>
        <h2 style={{ margin: 0 }}>{t("dashboard.hours.weeklyTitle")}</h2>
        {WEEKDAYS.map((day) => {
          const hour = hours.find((item) => item.weekday === day.value) ?? {
            weekday: day.value,
            opens_at: "07:00:00",
            closes_at: "22:00:00",
          };
          return (
            <div key={day.value} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: spacing.sm }}>
              <span>{day.label}</span>
              <input
                type="time"
                value={hour.opens_at.slice(0, 5)}
                onChange={(e) => updateHour(day.value, "opens_at", e.target.value)}
                style={fieldStyle}
              />
              <input
                type="time"
                value={hour.closes_at.slice(0, 5)}
                onChange={(e) => updateHour(day.value, "closes_at", e.target.value)}
                style={fieldStyle}
              />
            </div>
          );
        })}
        <button type="submit" style={primaryButtonStyle}>
          {t("dashboard.hours.save")}
        </button>
      </form>

      <form onSubmit={(event) => void addBlock(event)} style={cardStyle}>
        <h2 style={{ margin: 0 }}>{t("dashboard.hours.blockTitle")}</h2>
        <label style={labelStackStyle}>
          <span>{t("dashboard.hours.blockStartLabel")}</span>
          <input type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} style={fieldStyle} />
        </label>
        <label style={labelStackStyle}>
          <span>{t("dashboard.hours.blockEndLabel")}</span>
          <input type="datetime-local" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} style={fieldStyle} />
        </label>
        <label style={labelStackStyle}>
          <span>{t("dashboard.hours.blockReasonLabel")}</span>
          <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} style={fieldStyle} />
        </label>
        <button type="submit" style={secondaryButtonStyle}>
          {t("dashboard.hours.addBlock")}
        </button>
      </form>

      <section style={cardStyle}>
        <h2 style={{ margin: 0 }}>{t("dashboard.hours.upcomingBlocks")}</h2>
        {(detail?.blocks ?? []).length === 0 ? (
          <p style={{ margin: 0, color: colors.neutral[700] }}>{t("dashboard.hours.noBlocks")}</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {detail?.blocks.map((block) => (
              <li key={block.block_id} style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                <div>
                  <strong>{block.court_name}</strong>
                  <p style={{ margin: 0, color: colors.neutral[700] }}>
                    {formatBeirutTimeRange(block.starts_at, block.ends_at)}
                  </p>
                  {block.reason ? (
                    <p style={{ margin: 0, color: colors.neutral[500] }}>{block.reason}</p>
                  ) : null}
                </div>
                <button type="button" onClick={() => void removeBlock(block.block_id)} style={dangerButtonStyle}>
                  {t("dashboard.hours.removeBlock")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message ? <p style={{ margin: 0, color: colors.brand[700] }}>{message}</p> : null}
      {error ? (
        <p style={{ margin: 0, color: colors.danger[500] }} role="alert">
          {error}
        </p>
      ) : null}
    </DashboardShell>
  );
}
