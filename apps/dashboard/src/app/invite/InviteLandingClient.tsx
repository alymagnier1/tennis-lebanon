"use client";

import dynamic from "next/dynamic";

/**
 * Everything the invite page needs -- the fragment, the user agent, the
 * browser language -- exists only in the browser, and the server never sees
 * the token by design. Rendering on the client only lets the page read them
 * once, up front, instead of rendering a placeholder and swapping it out.
 */
export const InviteLandingClient = dynamic(
  () => import("./InviteLanding").then((module) => module.InviteLanding),
  {
    ssr: false,
    loading: () => (
      <main style={{ minHeight: "100vh", background: "#FAF9F6" }} />
    ),
  },
);
