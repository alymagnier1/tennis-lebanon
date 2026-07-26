"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getClubAdminDetail,
  upsertClubCourt,
  type AdminCourt,
  type ClubAdminDetail,
} from "@tennis-lebanon/api";
import { colors, spacing } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import { useStaffClubs } from "@/hooks/useStaffClubs";
import {
  SURFACE_OPTIONS,
  cardStyle,
  fieldStyle,
  labelStackStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/lib/form-styles";

export function CourtsEditor() {
  const { t } = useTranslation();
  const { client, clubId, isAdmin, loading: clubsLoading } = useStaffClubs();
  const [detail, setDetail] = useState<ClubAdminDetail | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [surface, setSurface] = useState("hard");
  const [priceMinor, setPriceMinor] = useState("");
  const [slotMinutes, setSlotMinutes] = useState("90");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!clubId) return;
    const data = await getClubAdminDetail(client, clubId);
    setDetail(data);
  };

  useEffect(() => {
    if (!clubId || !isAdmin) return;
    void load();
  }, [client, clubId, isAdmin]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSurface("hard");
    setPriceMinor("");
    setSlotMinutes("90");
  };

  const startEdit = (court: AdminCourt) => {
    setEditingId(court.court_id);
    setName(court.name);
    setSurface(court.surface);
    setPriceMinor(court.price_minor?.toString() ?? "");
    setSlotMinutes(court.slot_minutes.toString());
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clubId) return;
    setError(null);
    setMessage(null);
    try {
      await upsertClubCourt(client, clubId, {
        courtId: editingId ?? undefined,
        name,
        surface,
        priceMinor: priceMinor ? Number(priceMinor) : null,
        slotMinutes: Number(slotMinutes) || 90,
      });
      setMessage(t("dashboard.courts.saved"));
      resetForm();
      await load();
    } catch {
      setError(t("dashboard.courts.error"));
    }
  };

  if (clubsLoading) {
    return (
      <DashboardShell title={t("dashboard.courts.title")}>
        <p>…</p>
      </DashboardShell>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardShell title={t("dashboard.courts.title")}>
        <p style={{ color: colors.neutral[700] }}>{t("dashboard.settings.adminOnly")}</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t("dashboard.courts.title")}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: spacing.md }}>
        {(detail?.courts ?? []).map((court) => (
          <li key={court.court_id} style={cardStyle}>
            <strong>{court.name}</strong>
            <p style={{ margin: 0, color: colors.neutral[700] }}>
              {court.surface} · {court.price_minor ?? "—"} {court.currency} · {court.slot_minutes} min
            </p>
            <button type="button" onClick={() => startEdit(court)} style={secondaryButtonStyle}>
              {t("dashboard.courts.edit")}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={(event) => void onSubmit(event)} style={cardStyle}>
        <h2 style={{ margin: 0 }}>
          {editingId ? t("dashboard.courts.editTitle") : t("dashboard.courts.addTitle")}
        </h2>

        <label style={labelStackStyle}>
          <span>{t("dashboard.courts.nameLabel")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required style={fieldStyle} />
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.courts.surfaceLabel")}</span>
          <select value={surface} onChange={(e) => setSurface(e.target.value)} style={fieldStyle}>
            {SURFACE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.courts.priceLabel")}</span>
          <input value={priceMinor} onChange={(e) => setPriceMinor(e.target.value)} inputMode="numeric" style={fieldStyle} />
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.courts.slotLabel")}</span>
          <input value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} inputMode="numeric" style={fieldStyle} />
        </label>

        {message ? <p style={{ margin: 0, color: colors.brand[700] }}>{message}</p> : null}
        {error ? (
          <p style={{ margin: 0, color: colors.danger[500] }} role="alert">
            {error}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <button type="submit" style={primaryButtonStyle}>
            {editingId ? t("dashboard.courts.save") : t("dashboard.courts.add")}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              {t("common.cancel")}
            </button>
          ) : null}
        </div>
      </form>
    </DashboardShell>
  );
}
