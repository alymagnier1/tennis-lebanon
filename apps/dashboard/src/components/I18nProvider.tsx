"use client";

import { I18nextProvider } from "react-i18next";
import { i18next } from "@/lib/i18n.client";

/**
 * Client-side i18next instance for interactive dashboard screens. Server
 * Components render English directly; this provider only wraps subtrees
 * that need runtime language switching (e.g. the RTL check screen).
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
