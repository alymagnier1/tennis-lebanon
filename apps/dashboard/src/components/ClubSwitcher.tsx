"use client";

import { useTranslation } from "react-i18next";
import type { StaffClub } from "@tennis-lebanon/api";
import { fieldStyle, labelStackStyle } from "@/lib/form-styles";

/**
 * Club-scoped screens each hold their own `useStaffClubs` state and defaulted
 * to the first club with no way to change it. That was invisible while a club
 * account only ever had one club; a platform operator has every club, so
 * without this they could only ever administer whichever sorted first.
 */
export function ClubSwitcher({
  clubs,
  clubId,
  onChange,
}: {
  clubs: StaffClub[];
  clubId: string;
  onChange: (clubId: string) => void;
}) {
  const { t } = useTranslation();

  if (clubs.length < 2) return null;

  return (
    <label style={labelStackStyle}>
      <span>{t("dashboard.clubSwitcher.label")}</span>
      <select
        value={clubId}
        onChange={(event) => onChange(event.target.value)}
        style={fieldStyle}
      >
        {clubs.map((club) => (
          <option key={club.club_id} value={club.club_id}>
            {club.is_active
              ? club.name
              : t("dashboard.clubSwitcher.pendingOption", { name: club.name })}
          </option>
        ))}
      </select>
    </label>
  );
}
