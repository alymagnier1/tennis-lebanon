import { describe, expect, it } from "vitest";
import { NOTIFICATION_KINDS } from "@tennis-lebanon/domain";
import { resources } from "@tennis-lebanon/i18n";
import {
  interpolateNotificationCopy,
  NOTIFICATION_COPY,
  NOTIFICATION_LOCALES,
  normalizeNotificationLocale,
} from "../../../../supabase/functions/_shared/notification-copy";

/**
 * Notification copy exists in two places: the app's i18n bundle, and a
 * catalogue inside the Edge Function, which composes push text and cannot read
 * the app's bundle at runtime. The duplication is deliberate — importing across
 * the monorepo into the Deno bundle is fragile at deploy time — and this is
 * what stops it drifting.
 *
 * It lives in the mobile app rather than in `packages/i18n` or
 * `packages/domain` because both of those pin `rootDir` to their own `src`,
 * so neither can reference a file under `supabase/`. The app depends on both
 * packages and has no such constraint, which makes it the only place all three
 * sources are visible at once.
 */
describe("notification copy parity", () => {
  it("registers exactly the kinds the push catalogue carries", () => {
    expect([...NOTIFICATION_KINDS].sort()).toEqual(
      Object.keys(NOTIFICATION_COPY.en).sort(),
    );
  });

  it("covers every registered kind in every locale, on both sides", () => {
    const missing: string[] = [];

    for (const locale of NOTIFICATION_LOCALES) {
      const bundle = resources[locale].translation as {
        notifications: { kinds: Record<string, unknown> };
      };

      for (const kind of NOTIFICATION_KINDS) {
        if (!bundle.notifications.kinds[kind]) {
          missing.push(`i18n ${locale}.${kind}`);
        }
        if (!NOTIFICATION_COPY[locale]?.[kind]) {
          missing.push(`catalogue ${locale}.${kind}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("uses byte-identical strings on both sides", () => {
    const mismatches: string[] = [];

    for (const locale of NOTIFICATION_LOCALES) {
      const bundle = resources[locale].translation as {
        notifications: {
          kinds: Record<string, { title: string; body: string }>;
        };
      };

      for (const kind of NOTIFICATION_KINDS) {
        const app = bundle.notifications.kinds[kind];
        const push = NOTIFICATION_COPY[locale]?.[kind];
        if (!app || !push) continue;

        if (app.title !== push.title)
          mismatches.push(`${locale}.${kind}.title`);
        if (app.body !== push.body) mismatches.push(`${locale}.${kind}.body`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps placeholders matched across locales", () => {
    const placeholders = (value: string) =>
      (value.match(/\{\{(\w+)\}\}/g) ?? []).sort().join(",");

    for (const kind of NOTIFICATION_KINDS) {
      const english = NOTIFICATION_COPY.en[kind];
      if (!english) continue;

      for (const locale of NOTIFICATION_LOCALES) {
        const translated = NOTIFICATION_COPY[locale]?.[kind];
        if (!translated) continue;

        expect(
          placeholders(translated.body),
          `${locale}.${kind}.body placeholders differ from English`,
        ).toBe(placeholders(english.body));
      }
    }
  });
});

describe("normalizeNotificationLocale", () => {
  it("accepts the supported locales", () => {
    expect(normalizeNotificationLocale("ar")).toBe("ar");
    expect(normalizeNotificationLocale(" FR ")).toBe("fr");
  });

  it("falls back to English for anything else", () => {
    expect(normalizeNotificationLocale(null)).toBe("en");
    expect(normalizeNotificationLocale("de")).toBe("en");
  });
});

describe("interpolateNotificationCopy", () => {
  it("substitutes params", () => {
    expect(
      interpolateNotificationCopy(
        "Your court at {{clubName}}. Spots still open: {{spotsLeft}}.",
        { clubName: "Hippodrome", spotsLeft: 2 },
      ),
    ).toBe("Your court at Hippodrome. Spots still open: 2.");
  });

  it("leaves an unknown placeholder visible rather than blanking it", () => {
    expect(interpolateNotificationCopy("At {{clubName}}", {})).toBe(
      "At {{clubName}}",
    );
  });

  it("returns the template untouched when there are no params", () => {
    expect(interpolateNotificationCopy("No placeholders here", undefined)).toBe(
      "No placeholders here",
    );
  });
});
