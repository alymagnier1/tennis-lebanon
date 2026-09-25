import type { Metadata } from "next";
import { resources } from "@tennis-lebanon/i18n";
import { InviteLandingClient } from "./InviteLandingClient";

const copy = resources.en.translation.invitePage;

/**
 * Public landing page for shared invite links,
 * `https://racketbound.com/invite#<token>`.
 *
 * Static by design. The token lives in the fragment, which browsers never send
 * to the server, so this route never sees it and no request log can record it.
 * The page tells the visitor nothing about the match: anyone holding the link
 * can open it, and match details are for people who have signed in.
 */
export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: {
    title: copy.metaTitle,
    description: copy.metaDescription,
    siteName: "RacketBound",
    type: "website",
  },
};

export default function InvitePage() {
  return <InviteLandingClient />;
}
