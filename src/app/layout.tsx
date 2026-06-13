import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

// metadataBase makes the OG/twitter image URLs absolute (required by WhatsApp).
// Set NEXT_PUBLIC_SITE_URL to the real production domain in Vercel; the fallback
// keeps local/preview builds working.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://wk-poule-2026.vercel.app"),
  title: "WK 2026 Poule — Hotel van Saaze",
  description: "Voorspel het WK 2026. Een spel onder vrienden, geen kansspel.",
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: "Hotel van Saaze",
    title: "WK 2026 Poule — Hotel van Saaze",
    description: "Voorspel het hele WK 2026 mee — van de poules tot de finale. Een spel onder vrienden.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WK 2026 Poule — Hotel van Saaze",
    description: "Voorspel het hele WK 2026 mee. Een spel onder vrienden, geen kansspel.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
