"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { listStaffClubs } from "@tennis-lebanon/api";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

export function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("club-staff@tennis-lebanon.test");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const client = getSupabaseBrowserClient();
      const { error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? t("dashboard.login.invalidCredentials")
            : t("dashboard.login.error"),
        );
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        setError(t("dashboard.login.error"));
        return;
      }

      const clubs = await listStaffClubs(client);
      router.replace(clubs.length > 0 ? "/bookings" : "/onboarding");
      router.refresh();
    } catch {
      setError(t("dashboard.login.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        background: colors.neutral[50],
      }}
    >
      <form
        onSubmit={(event) => void onSubmit(event)}
        style={{
          width: "100%",
          maxWidth: 420,
          background: colors.neutral[0],
          borderRadius: radii.lg,
          padding: spacing.xl,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          border: `1px solid ${colors.neutral[100]}`,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: typography.size.lg,
              color: colors.neutral[900],
            }}
          >
            {t("dashboard.login.title")}
          </h1>
          <p
            style={{
              margin: `${spacing.sm}px 0 0`,
              color: colors.neutral[700],
            }}
          >
            {t("dashboard.login.description")}
          </p>
        </div>

        <label
          htmlFor="dashboard-login-email"
          style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}
        >
          <span>{t("dashboard.login.emailLabel")}</span>
          <input
            id="dashboard-login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "dashboard-login-error" : undefined}
            style={inputStyle}
          />
        </label>

        <label
          htmlFor="dashboard-login-password"
          style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}
        >
          <span>{t("dashboard.login.passwordLabel")}</span>
          <input
            id="dashboard-login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "dashboard-login-error" : undefined}
            style={inputStyle}
          />
        </label>

        {error ? (
          <p
            id="dashboard-login-error"
            style={{ margin: 0, color: colors.danger[500] }}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          style={buttonStyle}
          aria-busy={submitting}
        >
          {submitting
            ? t("dashboard.login.submitting")
            : t("dashboard.login.submit")}
        </button>

        <p
          style={{
            margin: 0,
            fontSize: typography.size.xs,
            color: colors.neutral[500],
          }}
        >
          {t("dashboard.login.devHint")}
        </p>
      </form>
    </main>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: radii.sm,
  border: `1px solid ${colors.neutral[100]}`,
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: typography.size.md,
};

const buttonStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: radii.sm,
  border: "none",
  background: colors.brand[600],
  color: colors.neutral[0],
  fontWeight: typography.weight.semibold,
  cursor: "pointer",
};
