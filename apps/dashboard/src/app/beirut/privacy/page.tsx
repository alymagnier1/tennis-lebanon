import { env } from "@/lib/env";
import { readBeirutWaitlistPrivacy } from "@/lib/legal-docs";
import styles from "./privacy.module.css";

export const metadata = {
  title: "Beirut waitlist privacy · RacketBound",
  description:
    "How RacketBound uses and protects your Beirut waitlist details, how long we keep them, and how to leave the list.",
};

export default function BeirutWaitlistPrivacyPage() {
  // Render trusted repository copy as text; never interpret document text as HTML.
  const blocks = readBeirutWaitlistPrivacy()
    .trim()
    .split(/\n\s*\n/);
  const title = blocks.find((block) => block.startsWith("# "))?.slice(2);
  const updated = blocks.find((block) => block.startsWith("Updated "));
  const version = blocks.find((block) => block.startsWith("Version: "));
  const body = blocks.filter(
    (block) =>
      !block.startsWith("# ") &&
      !block.startsWith("Updated ") &&
      !block.startsWith("Version: "),
  );
  const contactReady = !env.SUPPORT_EMAIL.endsWith(".invalid");
  const contact = contactReady ? (
    <a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a>
  ) : (
    <span>a contact address, which will be published before signup opens</span>
  );

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <a className={styles.back} href="/beirut">
          ← Back to RacketBound Beirut
        </a>
        <header className={styles.header}>
          <h1>{title}</h1>
          <p className={styles.updated}>{updated}</p>
        </header>
        <article
          className={styles.notice}
          aria-label="Waitlist privacy details"
        >
          {body.map((block, index) => {
            if (block.startsWith("## ")) {
              const heading = block.slice(3);
              return (
                <h2
                  key={index}
                  id={
                    heading === "Update your details or leave the list"
                      ? "your-choices"
                      : undefined
                  }
                >
                  {heading}
                </h2>
              );
            }
            if (block.startsWith("- ")) {
              return (
                <ul key={index}>
                  {block.split("\n").map((line, item) => (
                    <li key={item}>{line.slice(2)}</li>
                  ))}
                </ul>
              );
            }
            if (block.includes("{{SUPPORT_EMAIL}}")) {
              const [before, after] = block.split("{{SUPPORT_EMAIL}}");
              return (
                <p key={index}>
                  {before}
                  {contact}
                  {after}
                </p>
              );
            }
            return <p key={index}>{block}</p>;
          })}
        </article>
        {!contactReady && (
          <p role="status">
            This preview is not accepting registrations. A contact address will
            be published before signup opens.
          </p>
        )}
        <footer className={styles.footer}>
          <p>{version}</p>
          <a className={styles.back} href="/beirut">
            ← Back to RacketBound Beirut
          </a>
        </footer>
      </div>
    </main>
  );
}
