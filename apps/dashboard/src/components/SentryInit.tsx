"use client";

import { useEffect } from "react";
import { initClientSentry } from "@/lib/sentry.client";

/** Mounted once from the root layout; no-ops when no DSN is configured. */
export function SentryInit() {
  useEffect(() => {
    void initClientSentry();
  }, []);

  return null;
}
