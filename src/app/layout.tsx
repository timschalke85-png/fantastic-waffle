import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "WK 2026 Poule — Hotel van Saaze",
  description: "Voorspel het WK 2026. Een spel onder vrienden, geen kansspel.",
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
