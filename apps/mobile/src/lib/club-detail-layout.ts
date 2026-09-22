import { formatPriceMinor } from "@tennis-lebanon/domain";
import {
  clubBookingAction,
  type ClubBookingAction,
} from "./club-booking-action";

const KNOWN_AMENITIES = ["parking", "showers", "pay_as_you_play"] as const;
const KNOWN_SURFACES = ["hard", "clay", "grass", "carpet", "other"] as const;

export type KnownClubAmenity = (typeof KNOWN_AMENITIES)[number];
export type KnownClubSurface = (typeof KNOWN_SURFACES)[number];

export type ClubCourtFacts = {
  surface: string;
  is_indoor: boolean;
  price_minor: number | null;
  currency: string | null;
};

export type ClubFactChip =
  | { kind: "courts"; count: number }
  | { kind: "surface"; surface: string }
  | { kind: "indoor" }
  | { kind: "fromPrice"; priceLabel: string };

export type ClubPrimaryAction = ClubBookingAction;

/**
 * Browse (no match): WhatsApp is the only in-app booking path. In-app court
 * requests need a match id, so they do not appear here.
 */
export function clubBrowsePrimaryAction(
  whatsappAvailable: boolean,
): ClubPrimaryAction {
  return whatsappAvailable ? "whatsapp" : "none";
}

/**
 * Match booking: one primary. WhatsApp wins when the club can actually open
 * a thread; otherwise the in-app request. Never both.
 */
export function clubMatchPrimaryAction(club: {
  whatsapp_booking_available: boolean;
  booking_mode: string;
}): ClubPrimaryAction {
  if (club.whatsapp_booking_available) return "whatsapp";
  return clubBookingAction(club.booking_mode);
}

export function uniqueClubSurfaces(courts: ClubCourtFacts[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const court of courts) {
    if (!seen.has(court.surface)) {
      seen.add(court.surface);
      ordered.push(court.surface);
    }
  }
  return ordered;
}

export function clubHasIndoorCourt(courts: ClubCourtFacts[]): boolean {
  return courts.some((court) => court.is_indoor);
}

export function cheapestClubPrice(
  courts: ClubCourtFacts[],
): { price_minor: number; currency: string } | null {
  let cheapest: { price_minor: number; currency: string } | null = null;
  for (const court of courts) {
    if (court.price_minor == null || !court.currency) continue;
    if (!cheapest || court.price_minor < cheapest.price_minor) {
      cheapest = {
        price_minor: court.price_minor,
        currency: court.currency,
      };
    }
  }
  return cheapest;
}

export function clubFactChips(courts: ClubCourtFacts[]): ClubFactChip[] {
  const chips: ClubFactChip[] = [];
  if (courts.length > 0) {
    chips.push({ kind: "courts", count: courts.length });
  }

  for (const surface of uniqueClubSurfaces(courts).slice(0, 3)) {
    chips.push({ kind: "surface", surface });
  }

  if (clubHasIndoorCourt(courts)) {
    chips.push({ kind: "indoor" });
  }

  const cheapest = cheapestClubPrice(courts);
  if (cheapest) {
    const priceLabel = formatPriceMinor(
      cheapest.price_minor,
      cheapest.currency,
    );
    if (priceLabel) {
      chips.push({ kind: "fromPrice", priceLabel });
    }
  }

  return chips;
}

export function clubAmenityI18nKey(
  amenity: string,
): `clubs.amenity.${KnownClubAmenity}` | null {
  if (!(KNOWN_AMENITIES as readonly string[]).includes(amenity)) {
    return null;
  }
  return `clubs.amenity.${amenity as KnownClubAmenity}`;
}

export function humanizeClubAmenity(amenity: string): string {
  return amenity.replace(/_/g, " ");
}

export function isKnownClubSurface(
  surface: string,
): surface is KnownClubSurface {
  return (KNOWN_SURFACES as readonly string[]).includes(surface);
}
