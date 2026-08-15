import { describe, expect, it } from "vitest";
import { formatUtcInBeirut } from "./beirut-time";
import { resolveNotificationCopy } from "./notification-copy";

/**
 * Stands in for i18next: echoes the key so assertions can tell "translated" from
 * "fell back to the payload", and substitutes {{params}} the same way.
 */
const t = (key: string, params?: Record<string, unknown>): string => {
  const templates: Record<string, string> = {
    "notifications.kinds.match_invitation.title": "Match invite",
    "notifications.kinds.match_invitation.body": "Someone invited you.",
    "notifications.kinds.match_court_released.title": "Court no longer booked",
    "notifications.kinds.match_court_released.body":
      "{{clubName}} at {{startsAt}} fell through.",
    "notifications.fallbackTitle": "Tennis Lebanon",
    "notifications.fallbackBody": "Open the app for an update.",
  };

  const template = templates[key] ?? key;
  if (!params) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
};

describe("resolveNotificationCopy", () => {
  it("translates a known kind instead of using the payload's English", () => {
    const copy = resolveNotificationCopy(
      {
        kind: "match_invitation",
        payload: {
          title: "New match invitation",
          body: "Open the app to view and respond to your invitation.",
        },
      },
      t,
    );

    // The payload copy is what the SQL literal sends; the whole point of this
    // change is that it stops winning.
    expect(copy.title).toBe("Match invite");
    expect(copy.body).toBe("Someone invited you.");
  });

  it("interpolates params, showing the time in Beirut", () => {
    const copy = resolveNotificationCopy(
      {
        kind: "match_court_released",
        payload: {
          title: "Court no longer booked",
          body: "The club at some time fell through.",
          params: {
            clubName: "Hippodrome",
            startsAt: "2026-08-20T15:00:00Z",
          },
        },
      },
      t,
    );

    expect(copy.body).toContain("Hippodrome");
    // Rendered in Beirut rather than UTC. Compared against the shared formatter
    // instead of a literal, because the exact string is device-locale dependent
    // — what matters is that the param went through it and the raw ISO did not
    // leak into user-facing copy.
    expect(copy.body).toContain(formatUtcInBeirut("2026-08-20T15:00:00Z"));
    expect(copy.body).not.toContain("2026-08-20T15:00:00Z");
    expect(copy.body).not.toContain("{{");
  });

  it("falls back to the payload when a template's params are missing", () => {
    const copy = resolveNotificationCopy(
      {
        kind: "match_court_released",
        payload: {
          title: "Court no longer booked",
          body: "The club at Tue 20 Aug, 18:00 fell through.",
        },
      },
      t,
    );

    // Correct English beats showing a player a raw "{{clubName}}".
    expect(copy.body).toBe("The club at Tue 20 Aug, 18:00 fell through.");
  });

  it("uses the payload for a kind this build does not know", () => {
    const copy = resolveNotificationCopy(
      {
        kind: "something_added_later",
        payload: { title: "Newer server", body: "Something happened." },
      },
      t,
    );

    expect(copy.title).toBe("Newer server");
    expect(copy.body).toBe("Something happened.");
  });

  it("falls back to generic copy for an unknown kind with an empty payload", () => {
    const copy = resolveNotificationCopy(
      { kind: "something_added_later", payload: {} },
      t,
    );

    expect(copy.title).toBe("Tennis Lebanon");
    expect(copy.body).toBe("Open the app for an update.");
  });

  it("handles a null payload", () => {
    const copy = resolveNotificationCopy(
      { kind: "match_invitation", payload: null },
      t,
    );

    expect(copy.title).toBe("Match invite");
  });
});
