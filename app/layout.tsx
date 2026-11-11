import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/utils/format";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Be With Yoga — Yoga classes & retreats in Mallorca", template: "%s | Be With Yoga" },
  description: "Yoga with Angela in Mallorca: group classes, retreats and personal practice. Stay with an open heart.",
  applicationName: "Be With Yoga",
  openGraph: { siteName: "Be With Yoga", locale: "en_GB", type: "website" },
};
export const viewport: Viewport = { themeColor: "#f7f5f0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
