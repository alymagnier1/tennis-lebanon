import Link from "next/link";
import { env } from "@/lib/env";
import { colors, spacing, typography } from "@tennis-lebanon/ui";

type HealthState = "ok" | "error";

async function checkSupabaseHealth(): Promise<HealthState> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: env.SUPABASE_ANON_KEY },
      cache: "no-store",
    });
    return response.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

/** Milestone 0 health route. Server Component; no client JS required. */
export default async function HealthPage() {
  const state = await checkSupabaseHealth();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <h1 style={{ fontSize: typography.size["2xl"], margin: 0 }}>
        System health
      </h1>
      <p
        style={{
          fontSize: typography.size.md,
          color: state === "ok" ? colors.brand[600] : colors.danger[500],
          margin: 0,
        }}
      >
        {state === "ok"
          ? "All systems operational"
          : "Could not reach backend services"}
      </p>
      <p style={{ fontSize: typography.size.xs, color: colors.neutral[500] }}>
        env: {env.APP_ENV}
      </p>
      <Link
        href="/rtl-check"
        style={{ fontSize: typography.size.md, color: colors.brand[600] }}
      >
        Arabic RTL check &rarr;
      </Link>
    </main>
  );
}
