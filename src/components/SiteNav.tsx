"use client";

// Slim public navigation. Only links to routes that exist (extended per fase).
// The current page is marked consistently (aria-current + a filled pill).
import Link from "next/link";
import { usePathname } from "next/navigation";

// Scenario's staat achteraan: minst relevant (puur informatief, voor jezelf).
// "Win" (prijzenpoule) zit tussen Klassement en Scenario's.
const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Overzicht" },
  { href: "/voorspellen", label: "Voorspellen" },
  { href: "/klassement", label: "Klassement" },
  { href: "/win", label: "Win" },
  { href: "/scenarios", label: "Scenario's" },
];

function isActive(pathname: string, href: string): boolean {
  // "/" only matches exactly; others also match nested routes (e.g. /win/...).
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="sticky top-0 z-10 border-b border-brand-ink/10 bg-brand-surface/90 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-2 text-sm">
        {LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full bg-brand-ink/10 px-3 py-1.5 font-semibold text-brand-ink"
                    : "rounded-full px-3 py-1.5 text-brand-ink/70 hover:bg-brand-ink/5 hover:text-brand-ink"
                }
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
