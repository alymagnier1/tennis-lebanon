import Link from "next/link";
import { notFound } from "next/navigation";
import { colors, semantic, spacing, typography } from "@tennis-lebanon/ui";
import {
  isLegalSlug,
  readLegalMarkdown,
  type LegalSlug,
} from "@/lib/legal-docs";

const TITLES: Record<LegalSlug, string> = {
  terms: "Terms of Use",
  privacy: "Privacy Notice",
  community: "Community Rules",
};

export function generateStaticParams(): { slug: LegalSlug }[] {
  return [{ slug: "terms" }, { slug: "privacy" }, { slug: "community" }];
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) {
    notFound();
  }

  const markdown = readLegalMarkdown(slug);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: semantic.surface,
        color: semantic.textPrimary,
        padding: spacing.lg,
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: typography.fontFamily.base,
      }}
    >
      <p
        style={{
          fontSize: typography.size.sm,
          color: semantic.textTertiary,
          marginBottom: spacing.sm,
        }}
      >
        DEVELOPMENT DRAFT — not legally approved. Staging URL only until counsel
        signs off.
      </p>
      <h1 style={{ fontSize: typography.size["2xl"] }}>{TITLES[slug]}</h1>
      <nav style={{ display: "flex", gap: spacing.md, margin: `${spacing.md} 0` }}>
        <Link href="/legal/terms" style={{ color: colors.brand[600] }}>
          Terms
        </Link>
        <Link href="/legal/privacy" style={{ color: colors.brand[600] }}>
          Privacy
        </Link>
        <Link href="/legal/community" style={{ color: colors.brand[600] }}>
          Community
        </Link>
      </nav>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          fontFamily: typography.fontFamily.base,
          fontSize: typography.size.md,
          lineHeight: 1.5,
        }}
      >
        {markdown}
      </pre>
    </main>
  );
}
