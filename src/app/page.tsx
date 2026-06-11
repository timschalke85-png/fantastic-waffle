// Overzicht (placeholder until Fase 3). For Fase 2 this proves the on-demand
// refresh loop: every request refreshes match data from the provider (subject to
// the 60s/15min staleness gate) and renders live results from the DB.
import { prisma } from "@/lib/db";
import { refreshMatchData } from "@/lib/refresh";
import { getGroupLockUtc } from "@/lib/settings";
import { fmtDateTimeAms, fmtRelativeNl, fmtTimeAms } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_NL: Record<string, string> = {
  SCHEDULED: "Gepland",
  LIVE: "Live",
  FINISHED: "Afgelopen",
};

export default async function Home() {
  // Data loader: refresh-on-request (self-throttled), then read from the DB.
  const refresh = await refreshMatchData();
  const [groupF, lock] = await Promise.all([
    prisma.match.findMany({
      where: { groupLetter: "F" },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { kickoffUtc: "asc" },
    }),
    getGroupLockUtc(),
  ]);

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-8">
      <p className="text-xs uppercase tracking-wide text-brand-accent">Hotel van Saaze</p>
      <h1 className="mt-1 text-3xl font-bold">WK 2026 Poule</h1>
      <p className="mt-1 text-sm text-brand-ink/60">
        Laatst bijgewerkt: {fmtRelativeNl(refresh.lastFetchUtc)}
        {refresh.inLiveWindow ? " · live-venster actief (ververs elke 60s)" : ""}
        {refresh.reason === "error" ? " · API tijdelijk niet bereikbaar" : ""}
      </p>

      <section className="mt-6 rounded-lg border border-brand-accent/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-brand-accent px-2 py-0.5 text-xs font-semibold text-white">
            Poule F
          </span>
          <span className="text-xs text-brand-ink/60">
            Deadline groepsvoorspelling: {lock ? fmtDateTimeAms(lock) : "—"}
          </span>
        </div>
        <ul className="divide-y">
          {groupF.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-brand-ink/60">{fmtTimeAms(m.kickoffUtc)}</span>
              <span className="flex-1 px-3">
                {(m.homeTeam?.nameNl ?? "—") + " – " + (m.awayTeam?.nameNl ?? "—")}
              </span>
              <span className="tabular font-medium">
                {m.status === "SCHEDULED"
                  ? STATUS_NL[m.status]
                  : `${m.homeScore ?? 0}–${m.awayScore ?? 0}`}
                {m.status === "LIVE" && (
                  <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 align-middle" />
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-xs text-brand-ink/50">
        Het volledige Overzicht (alle poules, beste nummers 3, klassement) volgt in Fase 3.
      </p>
    </main>
  );
}
