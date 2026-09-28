import type { Metadata } from "next";
import { SentryInit } from "@/components/SentryInit";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "RacketBound Dashboard",
  description: "Club and platform operations dashboard.",
  icons: {
    icon: "/brand/racketbound-icon.png",
    apple: "/brand/racketbound-icon.png",
  },
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
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
