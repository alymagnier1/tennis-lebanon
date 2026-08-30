import { readFileSync } from "node:fs";
import path from "node:path";

const FILES = {
  terms: "TERMS_DEV.md",
  privacy: "PRIVACY_DEV.md",
  community: "COMMUNITY_RULES_DEV.md",
} as const;

export type LegalSlug = keyof typeof FILES;

export function isLegalSlug(value: string): value is LegalSlug {
  return value in FILES;
}

export function readLegalMarkdown(slug: LegalSlug): string {
  const fileName = FILES[slug];
  const candidates = [
    path.join(process.cwd(), "docs", "legal", fileName),
    path.join(process.cwd(), "..", "..", "docs", "legal", fileName),
  ];

  for (const filePath of candidates) {
    try {
      return readFileSync(filePath, "utf8");
    } catch {
      // try the next candidate
    }
  }

  throw new Error(`Legal document not found: ${fileName}`);
}
