"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  listActiveZones,
  registerPilotClub,
  type ActiveZone,
} from "@tennis-lebanon/api";
import { colors, spacing } from "@tennis-lebanon/ui";
import { DashboardShell } from "@/components/DashboardShell";
import {
  AMENITY_OPTIONS,
  SURFACE_OPTIONS,
  cardStyle,
  fieldStyle,
  labelStackStyle,
  primaryButtonStyle,
  slugify,
  zoneLabel,
} from "@/lib/form-styles";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

export function OnboardingForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [zones, setZones] = useState<ActiveZone[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [amenities, setAmenities] = useState<string[]>(["parking"]);
  const [courtName, setCourtName] = useState("Court 1");
  const [surface, setSurface] = useState("hard");
  const [priceMinor, setPriceMinor] = useState("4000");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    void listActiveZones(getSupabaseBrowserClient()).then((data) => {
      setZones(data);
      if (data[0]) {
        setZoneId(data[0].zone_id);
      }
    });
  }, []);

  const toggleAmenity = (amenity: string) => {
    setAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    );
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const clubId = await registerPilotClub(getSupabaseBrowserClient(), {
        name,
        slug,
        zoneId,
        description,
        addressPublic: address,
        amenities,
        courts: [
          {
            name: courtName,
            surface,
            price_minor: Number(priceMinor) || null,
            currency: "USD",
            slot_minutes: 90,
          },
        ],
      });
      router.replace(`/settings?club=${clubId}`);
    } catch {
      setError(t("dashboard.onboarding.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell title={t("dashboard.onboarding.title")}>
      <p style={{ margin: 0, color: colors.neutral[700] }}>
        {t("dashboard.onboarding.description")}
      </p>

      <form onSubmit={(event) => void onSubmit(event)} style={cardStyle}>
        <label style={labelStackStyle}>
          <span>{t("dashboard.onboarding.nameLabel")}</span>
          <input
            value={name}
            onChange={(e) => {
              const nextName = e.target.value;
              setName(nextName);
              if (!slugManuallyEdited) {
                setSlug(slugify(nextName));
              }
            }}
            required
            style={fieldStyle}
          />
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.onboarding.slugLabel")}</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              setSlug(slugify(e.target.value));
            }}
            required
            style={fieldStyle}
          />
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.onboarding.zoneLabel")}</span>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            required
            style={fieldStyle}
          >
            {zones.map((zone) => (
              <option key={zone.zone_id} value={zone.zone_id}>
                {zoneLabel(zone.name_i18n, zone.slug)}
              </option>
            ))}
          </select>
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
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing.sm,
              marginTop: spacing.sm,
            }}
          >
            {AMENITY_OPTIONS.map((amenity) => (
              <label
                key={amenity}
                style={{
                  display: "flex",
                  gap: spacing.xs,
                  alignItems: "center",
                }}
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

        <h2 style={{ margin: 0 }}>
          {t("dashboard.onboarding.firstCourtTitle")}
        </h2>

        <label style={labelStackStyle}>
          <span>{t("dashboard.courts.nameLabel")}</span>
          <input
            value={courtName}
            onChange={(e) => setCourtName(e.target.value)}
            required
            style={fieldStyle}
          />
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.courts.surfaceLabel")}</span>
          <select
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            style={fieldStyle}
          >
            {SURFACE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStackStyle}>
          <span>{t("dashboard.courts.priceLabel")}</span>
          <input
            value={priceMinor}
            onChange={(e) => setPriceMinor(e.target.value)}
            inputMode="numeric"
            style={fieldStyle}
          />
        </label>

        {error ? (
          <p style={{ margin: 0, color: colors.danger[500] }} role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} style={primaryButtonStyle}>
          {t("dashboard.onboarding.submit")}
        </button>
      </form>
    </DashboardShell>
  );
}
