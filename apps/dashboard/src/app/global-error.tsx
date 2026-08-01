"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/sentry.client";

/**
 * Last resort: catches throws from the root layout itself, which `error.tsx`
 * sits inside and therefore cannot handle.
 *
 * This replaces the root layout, so it has to supply its own html/body and
 * cannot assume the stylesheet or any provider loaded — inline styles only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError(error, { digest: error.digest, scope: "root" });
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#1a1a1a",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          The dashboard could not load
        </h1>
        <p style={{ fontSize: "0.95rem", maxWidth: "36rem" }}>
          An unexpected error stopped the page from starting. Nothing you
          submitted has been lost.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.75rem",
            minHeight: "44px",
            padding: "0 1.5rem",
            borderRadius: "10px",
            border: "none",
            background: "#0d76b0",
            color: "#ffffff",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
