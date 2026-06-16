import Link from "next/link";

// Overview → prijzenpoule call-to-action. Same slot/brand style as the old
// teaser, now with a direct button to /win. Keep amounts vague — no concrete
// prizes promised yet ("gave prijzen"), only that there's something to win.
export function WinCta() {
  return (
    <section
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-copper to-wk-orange px-5 py-4 text-white shadow-sm"
      aria-label="Win bij Van Saaze"
    >
      <span className="shrink-0 text-3xl" aria-hidden>
        🎁
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">Win bij Van Saaze</p>
        <p className="text-lg font-extrabold leading-tight">Speel mee en win gave prijzen</p>
        <p className="mt-0.5 text-sm text-white/90">
          Check in op wedstrijdavonden en maak kans op de avondprijzen.
        </p>
      </div>
      <Link
        href="/win"
        className="w-full rounded-lg bg-white px-4 py-2 text-center text-sm font-bold text-brand-copper shadow-sm transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto"
      >
        Meedoen →
      </Link>
    </section>
  );
}
