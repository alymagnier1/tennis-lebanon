"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  buildInviteOpenAppUrl,
  detectInvitePlatform,
  parseInviteFragment,
  type InvitePlatform,
} from "@tennis-lebanon/domain";
import {
  DEFAULT_LOCALE,
  getTextDirection,
  isSupportedLocale,
  type SupportedLocale,
} from "@tennis-lebanon/i18n";
import { radii, spacing, typography } from "@tennis-lebanon/ui";
import { env } from "@/lib/env";

/**
 * The app's own light palette (`apps/mobile/src/theme/tennis-tokens.ts`), not
 * the dashboard's blue: this is the last screen a new player sees before the
 * app, and it should look like the thing they are about to install.
 */
const APP_COLORS = {
  primary: "#0C382E",
  onPrimary: "#FFFFFF",
  ink: "#0D1C14",
  background: "#FAF9F6",
  card: "#FFFFFF",
  border: "#E9EBE8",
  mutedForeground: "#5C6A62",
} as const;

/**
 * Survives "Get the app" and Back in the same tab, which a stripped fragment
 * would not. Session-scoped and never sent anywhere.
 */
const TOKEN_SESSION_KEY = "racketbound.invite-token";

type TokenSource = { token: string | null; inAddressBar: boolean };

/** Pure read: the fragment first, then the copy kept for this tab. */
function readInviteToken(): TokenSource {
  const fromHash = parseInviteFragment(window.location.hash);
  if (fromHash) return { token: fromHash, inAddressBar: true };

  try {
    const stored = window.sessionStorage.getItem(TOKEN_SESSION_KEY);
    return {
      token: stored ? parseInviteFragment(stored) : null,
      inAddressBar: false,
    };
  } catch {
    return { token: null, inAddressBar: false };
  }
}

function browserLocale(): SupportedLocale {
  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of tags) {
    const base = tag?.toLowerCase().split("-")[0];
    if (base && isSupportedLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Client-only: rendered through `InviteLandingClient`, never on the server. */
export function InviteLanding() {
  const { i18n } = useTranslation();
  const [{ token, inAddressBar }] = useState(readInviteToken);
  const [platform] = useState(() => detectInvitePlatform(navigator.userAgent));
  const [locale] = useState(browserLocale);
  // A fixed translator rather than `changeLanguage`: the first paint is already
  // in the visitor's language, and the dashboard's shared instance is untouched.
  const t = i18n.getFixedT(locale);

  useEffect(() => {
    if (!token || !inAddressBar) return;
    try {
      window.sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    } catch {
      // Private mode or storage disabled: Back will lose the token, nothing worse.
    }
    // Out of the address bar, which is where history, screenshots and error
    // reports read the URL from.
    window.history.replaceState(null, "", window.location.pathname);
  }, [token, inAddressBar]);

  const getAppUrl = env.GET_APP_URL || null;
  const direction = getTextDirection(locale);

  return (
    <main lang={locale} dir={direction} style={pageStyle}>
      <div style={cardStyle}>
        <Image
          src="/brand/racketbound-lockup.svg"
          alt="RacketBound"
          width={184}
          height={46}
          priority
          unoptimized
        />

        {token ? (
          <ReadyInvite
            t={t}
            token={token}
            platform={platform}
            getAppUrl={getAppUrl}
          />
        ) : (
          <>
            <h1 style={titleStyle}>{t("invitePage.incompleteTitle")}</h1>
            <p style={bodyStyle}>{t("invitePage.incompleteBody")}</p>
            {getAppUrl ? (
              <a href={getAppUrl} style={secondaryButtonStyle}>
                {t("invitePage.getApp")}
              </a>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function ReadyInvite({
  t,
  token,
  platform,
  getAppUrl,
}: {
  t: TFunction;
  token: string;
  platform: InvitePlatform;
  getAppUrl: string | null;
}) {
  const openAppUrl = buildInviteOpenAppUrl(token, platform, getAppUrl);

  return (
    <>
      <h1 style={titleStyle}>{t("invitePage.title")}</h1>
      <p style={bodyStyle}>{t("invitePage.body")}</p>

      {openAppUrl ? (
        <div style={actionsStyle}>
          <a href={openAppUrl} style={primaryButtonStyle}>
            {t("invitePage.openApp")}
          </a>
          {getAppUrl ? (
            <a href={getAppUrl} style={secondaryButtonStyle}>
              {t("invitePage.getApp")}
            </a>
          ) : null}
          {getAppUrl ? (
            <p style={hintStyle}>{t("invitePage.installedHint")}</p>
          ) : null}
        </div>
      ) : (
        <p style={hintStyle}>{t("invitePage.desktopHint")}</p>
      )}
    </>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: APP_COLORS.background,
  color: APP_COLORS.ink,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: spacing.lg,
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: APP_COLORS.card,
  border: `1px solid ${APP_COLORS.border}`,
  borderRadius: radii.xl,
  padding: spacing["2xl"],
  display: "flex",
  flexDirection: "column",
  gap: spacing.lg,
  textAlign: "start",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: typography.size["2xl"],
  lineHeight: `${typography.lineHeight["2xl"]}px`,
  letterSpacing: typography.letterSpacing.tight,
  fontWeight: typography.weight.bold,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: typography.size.md,
  lineHeight: `${typography.lineHeight.md}px`,
  color: APP_COLORS.mutedForeground,
};

const hintStyle: CSSProperties = {
  ...bodyStyle,
  fontSize: typography.size.sm,
  lineHeight: `${typography.lineHeight.sm}px`,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
  marginTop: spacing.sm,
};

const buttonBase: CSSProperties = {
  minHeight: 52,
  borderRadius: radii.full,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `${spacing.md}px ${spacing.xl}px`,
  fontSize: typography.size.md,
  fontWeight: typography.weight.semibold,
  textDecoration: "none",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBase,
  background: APP_COLORS.primary,
  color: APP_COLORS.onPrimary,
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBase,
  background: APP_COLORS.card,
  color: APP_COLORS.primary,
  border: `1.5px solid ${APP_COLORS.primary}`,
};
