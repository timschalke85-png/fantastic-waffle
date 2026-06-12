// Branded Hotel van Saaze footer (chrome: olive + copper). Self-contained and
// reusable — drop it into the shared layout later to show it site-wide (e.g.
// under /voorspellen) without a rebuild. Static: no API data.
//
// asset volgt — Tim plaatst public/brand/leeuw-mark.svg (wapen, achtergrond).
// fs-check path: <project root>/public/brand/leeuw-mark.svg
import type { ReactNode } from "react";
import { existsSync } from "node:fs";
import { join } from "node:path";

const LEEUW_SRC = "/brand/leeuw-mark.svg";
const LEEUW_DISK = join(process.cwd(), "public", "brand", "leeuw-mark.svg");

// Socials — uitbreidbaar: voeg hier later extra netwerken toe als { label, href, icon }.
const SOCIALS: { label: string; href: string; icon: ReactNode }[] = [
  { label: "Instagram", href: "https://www.instagram.com/hotelvansaaze", icon: <InstagramIcon /> },
  // extra socials hier toevoegen (bijv. TikTok / Facebook)
];

export function BrandFooter() {
  const hasLeeuw = existsSync(LEEUW_DISK);
  return (
    <footer className="relative mt-10 overflow-hidden rounded-xl bg-brand-olive px-5 py-6 text-white">
      {hasLeeuw && (
        // Decorative crest behind the text; empty olive panel if the asset is absent.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={LEEUW_SRC}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 top-1/2 h-44 w-auto -translate-y-1/2 opacity-[0.08]"
        />
      )}
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <p className="text-base font-semibold">Kijk elke wedstrijd in het restaurant van Hotel van Saaze</p>
          <p className="mt-1 text-sm text-white/75">
            Groot scherm, alle wedstrijden — en een vers getapt Van Saaze-biertje. Tot ziens in Kraggenburg.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <a
            href="https://www.hotelvansaaze.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-brand-copper px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Naar onze website
          </a>
          <ul className="flex items-center gap-2">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-copper text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
