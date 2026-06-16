// Slim public navigation. Only links to routes that exist (extended per fase).
import Link from "next/link";

// Scenario's staat achteraan: minst relevant (puur informatief, voor jezelf).
const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Overzicht" },
  { href: "/voorspellen", label: "Voorspellen" },
  { href: "/klassement", label: "Klassement" },
  { href: "/win", label: "Win" },
  { href: "/scenarios", label: "Scenario's" },
];

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-brand-ink/10 bg-brand-surface/90 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-2 text-sm">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="rounded-full px-3 py-1.5 text-brand-ink/70 hover:bg-brand-ink/5 hover:text-brand-ink"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
