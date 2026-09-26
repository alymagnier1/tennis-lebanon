import { describe, expect, it } from "vitest";
import {
  buildAndroidInviteIntentUrl,
  buildInviteAppUrl,
  buildInviteOpenAppUrl,
  buildInviteWebUrl,
  detectInvitePlatform,
  INVITE_TOKEN_SESSION_KEY,
  isInviteToken,
  parseInviteFragment,
  readInviteToken,
  watchInviteToken,
  type InviteTokenHost,
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

  // `intent:` is a semicolon-delimited grammar Chrome parses into an Android
  // Intent, so a value carrying `;` or `#` would add fields to that intent
  // rather than simply producing a dead link.
  it("refuses anything that is not a token", () => {
    const fallback = "https://example.com/get";

    expect(
      buildAndroidInviteIntentUrl(`${TOKEN};component=evil/Evil`, fallback),
    ).toBeNull();
    expect(buildAndroidInviteIntentUrl("", fallback)).toBeNull();
    expect(
      buildAndroidInviteIntentUrl(TOKEN.slice(0, 47), fallback),
    ).toBeNull();
    expect(
      buildAndroidInviteIntentUrl(TOKEN.toUpperCase(), fallback),
    ).toBeNull();
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

/** A tab: an address bar, session storage, and fragment navigation. */
function fakeTab(url: { pathname?: string; hash?: string } = {}) {
  const store = new Map<string, string>();
  let listener: (() => void) | null = null;
  const host: InviteTokenHost = {
    location: { pathname: url.pathname ?? "/invite", hash: url.hash ?? "" },
    sessionStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
    },
    history: {
      replaceState: (_data, _unused, next) => {
        host.location.hash = "";
        host.location.pathname = next;
      },
    },
    addEventListener: (_type, next) => {
      listener = next;
    },
    removeEventListener: (_type, next) => {
      if (listener === next) listener = null;
    },
  };
  /** Opening a link in this tab when only the fragment differs: no reload. */
  const openFragment = (hash: string) => {
    host.location.hash = hash;
    listener?.();
  };
  return { host, store, openFragment, listening: () => listener !== null };
}

const OTHER = "fedcba9876543210fedcba9876543210fedcba9876543210";

describe("watchInviteToken", () => {
  it("adopts a token from the address bar, keeps it for the tab and hides it", () => {
    const tab = fakeTab({ hash: `#${TOKEN}` });
    const seen: string[] = [];

    watchInviteToken(tab.host, (token) => seen.push(token));

    expect(seen).toEqual([TOKEN]);
    expect(tab.store.get(INVITE_TOKEN_SESSION_KEY)).toBe(TOKEN);
    expect(tab.host.location.hash).toBe("");
    expect(tab.host.location.pathname).toBe("/invite");
  });

  it("switches to a second invite opened in the same tab", () => {
    const tab = fakeTab({ hash: `#${TOKEN}` });
    const seen: string[] = [];
    watchInviteToken(tab.host, (token) => seen.push(token));

    tab.openFragment(`#${OTHER}`);

    expect(seen).toEqual([TOKEN, OTHER]);
    expect(tab.store.get(INVITE_TOKEN_SESSION_KEY)).toBe(OTHER);
    expect(readInviteToken(tab.host)).toBe(OTHER);
  });

  it("ignores a fragment that is not a token and keeps the current invite", () => {
    const tab = fakeTab({ hash: `#${TOKEN}` });
    const seen: string[] = [];
    watchInviteToken(tab.host, (token) => seen.push(token));

    tab.openFragment("#not-a-token");

    expect(seen).toEqual([TOKEN]);
    expect(tab.store.get(INVITE_TOKEN_SESSION_KEY)).toBe(TOKEN);
  });

  it("stops listening when the page goes away", () => {
    const tab = fakeTab({ hash: `#${TOKEN}` });
    const stop = watchInviteToken(tab.host, () => undefined);

    stop();

    expect(tab.listening()).toBe(false);
  });

  it("still switches invites when session storage is unavailable", () => {
    const tab = fakeTab({ hash: `#${TOKEN}` });
    tab.host.sessionStorage.setItem = () => {
      throw new Error("SecurityError");
    };
    const seen: string[] = [];
    watchInviteToken(tab.host, (token) => seen.push(token));

    tab.openFragment(`#${OTHER}`);

    expect(seen).toEqual([TOKEN, OTHER]);
  });
});

describe("readInviteToken", () => {
  it("prefers the address bar over the tab's stored copy", () => {
    const tab = fakeTab({ hash: `#${OTHER}` });
    tab.store.set(INVITE_TOKEN_SESSION_KEY, TOKEN);

    expect(readInviteToken(tab.host)).toBe(OTHER);
  });

  it("falls back to the stored copy after Back from Get the app", () => {
    const tab = fakeTab();
    tab.store.set(INVITE_TOKEN_SESSION_KEY, TOKEN);

    expect(readInviteToken(tab.host)).toBe(TOKEN);
  });

  it("returns null when storage throws", () => {
    const tab = fakeTab();
    tab.host.sessionStorage.getItem = () => {
      throw new Error("SecurityError");
    };

    expect(readInviteToken(tab.host)).toBeNull();
  });
});
