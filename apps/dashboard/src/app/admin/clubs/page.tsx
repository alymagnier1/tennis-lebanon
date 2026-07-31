"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isPlatformOperator } from "@tennis-lebanon/api";
import { colors, typography } from "@tennis-lebanon/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { PendingClubsQueue } from "@/components/PendingClubsQueue";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

export default function AdminClubsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const operator = await isPlatformOperator(getSupabaseBrowserClient());
        if (!cancelled) {
          setAllowed(operator);
          if (!operator) {
            router.replace("/bookings");
          }
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
          router.replace("/bookings");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <RequireAuth>
      {allowed === null ? (
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.neutral[500],
            fontSize: typography.size.md,
          }}
        >
          {t("dashboard.pendingClubs.loading")}
        </main>
      ) : allowed ? (
        <PendingClubsQueue />
      ) : null}
    </RequireAuth>
  );
}
