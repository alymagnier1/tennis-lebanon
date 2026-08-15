"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getClubAdminDetail,
  updateClubBookingSettings,
  updateClubProfile,
  type ClubAdminDetail,
} from "@tennis-lebanon/api";
import { colors } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import { useStaffClubs } from "@/hooks/useStaffClubs";
import {
  AMENITY_OPTIONS,
  cardStyle,
  fieldStyle,
  labelStackStyle,
  primaryButtonStyle,
} from "@/lib/form-styles";
import { ClubDangerZone } from "./ClubDangerZone";
import { ClubSwitcher } from "./ClubSwitcher";

export function ClubSettingsForm() {
  const { t } = useTranslation();
  const {
    client,
    clubs,
    clubId,
    setClubId,
    activeClub,
    isAdmin,
    loading: clubsLoading,
  } = useStaffClubs();
  const [detail, setDetail] = useState<ClubAdminDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [bookingMode, setBookingMode] = useState<
    "manual_request" | "external_link"
  >("manual_request");
  const [bookingPhone, setBookingPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reloadDetail = useCallback(() => {
    if (!clubId || !isAdmin) return;
    void getClubAdminDetail(client, clubId).then((data) => {
      setDetail(data);
      setName(data.club.name);
      setDescription(data.club.description ?? "");
      setAddress(data.club.address_public ?? "");
      setAmenities(data.club.amenities ?? []);
      setBookingMode(
        data.club.booking_mode === "external_link"
          ? "external_link"
          : "manual_request",
      );
      setBookingPhone(data.club.booking_phone ?? "");
    });
  }, [client, clubId, isAdmin]);

  useEffect(() => {
    reloadDetail();
  }, [reloadDetail]);

  const toggleAmenity = (amenity: string) => {
    setAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    );
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clubId) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await updateClubProfile(client, clubId, {
        name,
        description,
        addressPublic: address,
        amenities,
      });
      await updateClubBookingSettings(client, clubId, {
        bookingMode,
        bookingPhone:
          bookingMode === "external_link" ? bookingPhone : bookingPhone || null,
      });
      setMessage(t("dashboard.settings.saved"));
    } catch {
      setError(t("dashboard.settings.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (clubsLoading) {
    return (
      <DashboardShell title={t("dashboard.settings.title")}>
        <p>…</p>
      </DashboardShell>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardShell title={t("dashboard.settings.title")}>
        <p style={{ color: colors.neutral[700] }}>
          {t("dashboard.settings.adminOnly")}
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t("dashboard.settings.title")}>
      <ClubSwitcher clubs={clubs} clubId={clubId} onChange={setClubId} />

      {activeClub ? (
        <p style={{ margin: 0, color: colors.neutral[700] }}>
          {activeClub.name}
        </p>
      ) : null}

      <form onSubmit={(event) => void onSubmit(event)} style={cardStyle}>
        <label style={labelStackStyle}>
          <span>{t("dashboard.onboarding.nameLabel")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={fieldStyle}
          />
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.onboarding.descriptionLabel")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={fieldStyle}
          />
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.onboarding.addressLabel")}</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
          <legend>{t("dashboard.onboarding.amenitiesLabel")}</legend>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
          >
            {AMENITY_OPTIONS.map((amenity) => (
              <label
                key={amenity}
                style={{ display: "flex", gap: 4, alignItems: "center" }}
              >
                <input
                  type="checkbox"
                  checked={amenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                />
                {t(`dashboard.amenities.${amenity}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
          <legend>{t("dashboard.settings.bookingModeLabel")}</legend>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 8,
            }}
          >
            <label
              style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
            >
              <input
                type="radio"
                name="bookingMode"
                checked={bookingMode === "manual_request"}
                onChange={() => setBookingMode("manual_request")}
              />
              <span>
                <strong>{t("dashboard.settings.bookingModeInApp")}</strong>
                <br />
                <span style={{ color: colors.neutral[500], fontSize: 14 }}>
                  {t("dashboard.settings.bookingModeInAppHint")}
                </span>
              </span>
            </label>
            <label
              style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
            >
              <input
                type="radio"
                name="bookingMode"
                checked={bookingMode === "external_link"}
                onChange={() => setBookingMode("external_link")}
              />
              <span>
                <strong>{t("dashboard.settings.bookingModeWhatsApp")}</strong>
                <br />
                <span style={{ color: colors.neutral[500], fontSize: 14 }}>
                  {t("dashboard.settings.bookingModeWhatsAppHint")}
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {bookingMode === "external_link" ? (
          <label style={labelStackStyle}>
            <span>{t("dashboard.settings.whatsappPhoneLabel")}</span>
            <input
              value={bookingPhone}
              onChange={(e) => setBookingPhone(e.target.value)}
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("dashboard.settings.whatsappPhonePlaceholder")}
              style={fieldStyle}
            />
            <span style={{ color: colors.neutral[500], fontSize: 14 }}>
              {t("dashboard.settings.whatsappPhoneHint")}
            </span>
          </label>
        ) : null}

        {detail ? (
          <p style={{ margin: 0, color: colors.neutral[500], fontSize: 14 }}>
            {t("dashboard.settings.slugHint", { slug: detail.club.slug })}
          </p>
        ) : null}

        {message ? (
          <p style={{ margin: 0, color: colors.brand[700] }}>{message}</p>
        ) : null}
        {error ? (
          <p style={{ margin: 0, color: colors.danger[500] }} role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} style={primaryButtonStyle}>
          {t("dashboard.settings.save")}
        </button>
      </form>

      {detail ? (
        <ClubDangerZone
          client={client}
          clubId={clubId}
          clubName={detail.club.name}
          isActive={detail.club.is_active}
          isOperator={activeClub?.role === "operator"}
          onChanged={reloadDetail}
        />
      ) : null}
    </DashboardShell>
  );
}
