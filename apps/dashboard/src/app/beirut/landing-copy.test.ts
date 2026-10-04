import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The Beirut landing page is static HTML built from apps/landing, so it does
 * not read the app's translations. These checks stop the page drifting from
 * the app again (docs/BEIRUT_LANDING_FIX_PLAN.md, item 1.13).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../../..");
const page = readFileSync(
  path.join(repo, "apps/dashboard/public/beirut/index.html"),
  "utf8",
);
const en = JSON.parse(
  readFileSync(path.join(repo, "packages/i18n/src/locales/en.json"), "utf8"),
) as {
  onboarding: { tennis: { bands: Record<string, string> } };
  skillBands: Record<string, string>;
};

describe("Beirut landing page copy", () => {
  it("describes each level exactly as the app's onboarding does", () => {
    const bands = en.onboarding.tennis.bands;
    for (const [band, description] of Object.entries(bands)) {
      const match = page.match(
        new RegExp(`value="${band}"><span><b>([^<]+)</b>([^<]+)</span>`),
      );
      expect(match, `level ${band} is on the page`).not.toBeNull();
      expect(match?.[1]).toBe(en.skillBands[band]);
      expect(match?.[2]).toBe(description);
    }
  });

  it("talks about the app invite, not a group being ready", () => {
    expect(page).not.toContain("group is ready");
  });

  it("ties the level hint and error to the level group", () => {
    expect(page).toContain(
      'id="level-field" aria-describedby="level-hint level-error"',
    );
  });

  it("confirms only what a saved signup means, with no queue-jumping claim", () => {
    expect(page).toContain("You’re on the Beirut list.");
    expect(page).toContain("There’s nothing else you need to do.");
    expect(page).not.toContain("sooner");
  });

  it("uses the canonical URL for link previews", () => {
    expect(page).toContain(
      '<meta property="og:url" content="https://racketbound.com/beirut">',
    );
  });
});
