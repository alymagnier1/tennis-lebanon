"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/sentry.client";

/**
 * Route-level fallback. Keeps the shell and navigation intact, so club staff
 * can move to another screen instead of losing the whole dashboard.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError(error, { digest: error.digest });
  }, [error]);

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>Something went wrong</h1>
      <p style={styles.body}>
        This page hit an unexpected error. Nothing you submitted has been lost.
      </p>
      <button type="button" onClick={reset} style={styles.button}>
        Try again
      </button>
    </main>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    minHeight: "60vh",
    padding: "1.5rem",
    textAlign: "center" as const,
  },
  title: { fontSize: "1.25rem", fontWeight: 600 },
  body: { fontSize: "0.95rem", maxWidth: "36rem" },
  button: {
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
  },
};
