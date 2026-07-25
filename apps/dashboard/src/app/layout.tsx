import type { Metadata } from "next";
import { SentryInit } from "@/components/SentryInit";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tennis Lebanon Dashboard (Dev)",
  description: "Club and platform operations dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <SentryInit />
        {children}
      </body>
    </html>
  );
}
