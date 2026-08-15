"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deactivateClub,
  reactivateClub,
  type TennisSupabaseClient,
} from "@tennis-lebanon/api";
import { colors, spacing } from "@tennis-lebanon/ui";
import {
  cardStyle,
  dangerButtonStyle,
  fieldStyle,
  labelStackStyle,
  secondaryButtonStyle,
} from "@/lib/form-styles";

/**
 * Deactivation is a soft delete: is_active flips off, courts and booking
 * history stay put, and it can be undone (065). Only the operator who can
 * approve/reject a club in the first place gets this -- a club's own admin
 * runs it day to day but does not get to take it offline platform-wide.
 */
export function ClubDangerZone({
  client,
  clubId,
  clubName,
  isActive,
  isOperator,
  onChanged,
}: {
  client: TennisSupabaseClient;
  clubId: string;
  clubName: string;
  isActive: boolean;
  isOperator: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOperator) return null;

  const onDeactivate = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await deactivateClub(client, clubId, reason || undefined);
      setMessage(t("dashboard.settings.dangerZoneDeactivated"));
      setConfirming(false);
      setReason("");
      onChanged();
    } catch (caught) {
      // A blocked deactivation ("N open booking(s)") is specific and
      // actionable, same reasoning as the onboarding form's error detail.
      const detail = caught instanceof Error ? caught.message.trim() : "";
      setError(
        detail
          ? t("dashboard.settings.dangerZoneErrorDetail", { detail })
          : t("dashboard.settings.dangerZoneError"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onReactivate = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await reactivateClub(client, clubId, reason || undefined);
      setMessage(t("dashboard.settings.dangerZoneReactivated"));
      setReason("");
      onChanged();
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message.trim() : "";
      setError(
        detail
          ? t("dashboard.settings.dangerZoneErrorDetail", { detail })
          : t("dashboard.settings.dangerZoneError"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      style={{
        ...cardStyle,
        border: `1px solid ${colors.danger[500]}`,
      }}
    >
      <h2 style={{ margin: 0 }}>{t("dashboard.settings.dangerZoneTitle")}</h2>
      <p style={{ margin: 0, color: colors.neutral[700] }}>
        {isActive
          ? t("dashboard.settings.dangerZoneStatusActive")
          : t("dashboard.settings.dangerZoneStatusInactive")}
      </p>

      {isActive && !confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={dangerButtonStyle}
        >
          {t("dashboard.settings.dangerZoneDeactivate")}
        </button>
      ) : null}

      {isActive && confirming ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}
        >
          <p style={{ margin: 0, color: colors.neutral[700] }}>
            {t("dashboard.settings.dangerZoneConfirmPrompt", {
              name: clubName,
            })}
          </p>
          <label style={labelStackStyle}>
            <span>{t("dashboard.settings.dangerZoneReasonLabel")}</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={fieldStyle}
            />
          </label>
          <div style={{ display: "flex", gap: spacing.sm }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void onDeactivate()}
              style={dangerButtonStyle}
            >
              {t("dashboard.settings.dangerZoneConfirmButton")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setConfirming(false);
                setReason("");
              }}
              style={secondaryButtonStyle}
            >
              {t("dashboard.settings.dangerZoneCancelButton")}
            </button>
          </div>
        </div>
      ) : null}

      {!isActive ? (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void onReactivate()}
          style={secondaryButtonStyle}
        >
          {t("dashboard.settings.dangerZoneReactivate")}
        </button>
      ) : null}

      {message ? (
        <p style={{ margin: 0, color: colors.brand[700] }}>{message}</p>
      ) : null}
      {error ? (
        <p style={{ margin: 0, color: colors.danger[500] }} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
