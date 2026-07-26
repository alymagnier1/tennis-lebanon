"use client";

import { I18nProvider } from "@/components/I18nProvider";
import { AuthProvider } from "@/providers/AuthProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  );
}
