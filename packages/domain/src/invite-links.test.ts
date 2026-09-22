import { describe, expect, it } from "vitest";
import {
  buildAndroidInviteIntentUrl,
  buildInviteAppUrl,
  buildInviteOpenAppUrl,
  buildInviteWebUrl,
  detectInvitePlatform,
  isInviteToken,
  parseInviteFragment,
} from "./invite-links";

const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef";

describe("isInviteToken", () => {
  it("accepts 48 lowercase hex characters", () => {
    expect(isInviteToken(TOKEN)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isInviteToken("")).toBe(false);
    expect(isInviteToken(TOKEN.slice(1))).toBe(false);
    expect(isInviteToken(`${TOKEN}0`)).toBe(false);
    expect(isInviteToken(TOKEN.replace("a", "g"))).toBe(false);
  });
});

describe("buildInviteWebUrl", () => {
  it("puts the token in the fragment, not the path", () => {
    expect(buildInviteWebUrl("https://racketbound.com", TOKEN)).toBe(
      `https://racketbound.com/invite#${TOKEN}`,
    );
  });

  it("tolerates a trailing slash on the base URL", () => {
    expect(buildInviteWebUrl("https://racketbound.com/", TOKEN)).toBe(
      `https://racketbound.com/invite#${TOKEN}`,
    );
  });
});

describe("parseInviteFragment", () => {
  it("reads the token from location.hash", () => {
    expect(parseInviteFragment(`#${TOKEN}`)).toBe(TOKEN);
  });

  it("round-trips what buildInviteWebUrl shares", () => {
    const url = buildInviteWebUrl("https://racketbound.com", TOKEN);
    expect(parseInviteFragment(url.slice(url.indexOf("#")))).toBe(TOKEN);
  });

  it("normalises case and surrounding whitespace", () => {
    expect(parseInviteFragment(`# ${TOKEN.toUpperCase()} `)).toBe(TOKEN);
  });

  it("returns null for a missing, truncated or padded token", () => {
    expect(parseInviteFragment("")).toBeNull();
    expect(parseInviteFragment("#")).toBeNull();
    expect(parseInviteFragment(`#${TOKEN.slice(0, 20)}`)).toBeNull();
    expect(parseInviteFragment(`#${TOKEN}&utm_source=wa`)).toBeNull();
  });
});

describe("buildInviteAppUrl", () => {
  it("targets the invite route through the app scheme", () => {
    expect(buildInviteAppUrl(TOKEN)).toBe(`tennislebanon:///invite/${TOKEN}`);
  });
});

describe("buildAndroidInviteIntentUrl", () => {
  it("names the scheme, the package and an encoded fallback", () => {
    const url = buildAndroidInviteIntentUrl(
      TOKEN,
      "https://expo.dev/accounts/x/builds/1?y=2",
    );

    expect(url).toBe(
      `intent:///invite/${TOKEN}#Intent;` +
        "scheme=tennislebanon;" +
        "package=com.racketbound.app;" +
        "S.browser_fallback_url=https%3A%2F%2Fexpo.dev%2Faccounts%2Fx%2Fbuilds%2F1%3Fy%3D2;" +
        "end",
    );
  });
});

describe("detectInvitePlatform", () => {
  it("recognises Android, including WhatsApp's in-app browser", () => {
    expect(
      detectInvitePlatform(
        "Mozilla/5.0 (Linux; Android 14; SM-A546B; wv) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
      ),
    ).toBe("android");
  });

  it("recognises iPhone and iPad", () => {
    expect(
      detectInvitePlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("ios");
    expect(detectInvitePlatform("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("ios");
  });

  it("treats everything else as desktop", () => {
    expect(
      detectInvitePlatform(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36",
      ),
    ).toBe("desktop");
    expect(detectInvitePlatform("")).toBe("desktop");
  });
});

describe("buildInviteOpenAppUrl", () => {
  const GET_APP = "https://expo.dev/accounts/x/builds/1";

  it("uses the intent URL on Android when there is somewhere to fall back to", () => {
    expect(buildInviteOpenAppUrl(TOKEN, "android", GET_APP)).toBe(
      buildAndroidInviteIntentUrl(TOKEN, GET_APP),
    );
  });

  it("falls back to the app scheme on Android without a get-the-app URL", () => {
    expect(buildInviteOpenAppUrl(TOKEN, "android", null)).toBe(
      buildInviteAppUrl(TOKEN),
    );
  });

  it("uses the app scheme on iOS", () => {
    expect(buildInviteOpenAppUrl(TOKEN, "ios", GET_APP)).toBe(
      buildInviteAppUrl(TOKEN),
    );
  });

  it("returns null on desktop, where there is no app to open", () => {
    expect(buildInviteOpenAppUrl(TOKEN, "desktop", GET_APP)).toBeNull();
  });
});
