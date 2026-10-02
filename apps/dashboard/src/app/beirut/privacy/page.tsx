import { env } from "@/lib/env";
import { readBeirutWaitlistPrivacy } from "@/lib/legal-docs";

export const metadata = { title: "Beirut waitlist privacy · RacketBound" };

export default function BeirutWaitlistPrivacyPage() {
  // Render the small, trusted repository document as text elements, never raw HTML.
  const blocks = readBeirutWaitlistPrivacy()
    .trim()
    .split(/\n\s*\n/);
  const contactReady = !env.SUPPORT_EMAIL.endsWith(".invalid");
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FAF9F6",
        color: "#0D1C14",
        padding: "40px 24px 72px",
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "Inter, system-ui, sans-serif",
        lineHeight: 1.7,
      }}
    >
      <a href="/beirut" style={{ color: "#0C382E" }}>
        ← Back to RacketBound Beirut
      </a>
      {blocks.map((block, index) => {
        if (block.startsWith("# "))
          return (
            <h1
              key={index}
              style={{ fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.15 }}
            >
              {block.slice(2)}
            </h1>
          );
        if (block.startsWith("## "))
          return (
            <h2 key={index} style={{ fontSize: 22, marginTop: 32 }}>
              {block.slice(3)}
            </h2>
          );
        if (block.startsWith("- "))
          return (
            <ul key={index} style={{ paddingLeft: 22 }}>
              {block.split("\n").map((line, item) => (
                <li key={item}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        return <p key={index}>{block}</p>;
      })}
      {contactReady ? (
        <p>
          For corrections or removal, email{" "}
          <a
            href={`mailto:${env.SUPPORT_EMAIL}`}
            style={{ color: "#0C382E", overflowWrap: "anywhere" }}
          >
            {env.SUPPORT_EMAIL}
          </a>
          .
        </p>
      ) : (
        <p role="status">
          This preview is not accepting registrations. A contact address will be
          published before signup opens.
        </p>
      )}
    </main>
  );
}
