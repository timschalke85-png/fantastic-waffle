// Klassement (Fase 7). Rank, bijnaam (full name only if the participant opted in),
// totaal, and a tap-to-expand breakdown (Poule F / Overige poules / Knock-out).
// Ordering is the cached comparator (loadKlassement); the "laatst bijgewerkt"
// stamp shows the real recompute moment, never "now". Honest empty state until
// recompute produces results.
import { loadKlassement, type KlassementEntry } from "@/lib/klassement-data";
import { fmtRelativeNl } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Klassement() {
  const { entries, lastUpdatedUtc } = await loadKlassement();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-wide text-brand-accent">Hotel van Saaze</p>
        <h1 className="text-2xl font-bold leading-tight">Klassement</h1>
        <p className="mt-2 text-[11px] text-brand-ink/50">
          Laatst bijgewerkt: {fmtRelativeNl(lastUpdatedUtc)} · punten worden automatisch herberekend
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-ink/20 p-6 text-center">
          <p className="text-sm font-medium">Nog geen klassement</p>
          <p className="mt-1 text-[12px] text-brand-ink/55">
            Zodra er wedstrijden zijn gespeeld en deelnemers hebben voorspeld, verschijnen hier de punten.
          </p>
        </div>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((e) => (
            <Row key={e.participantId} e={e} />
          ))}
        </ol>
      )}

      <p className="mt-8 text-center text-xs text-brand-ink/40">Een spel onder vrienden, geen kansspel.</p>
    </main>
  );
}

function Row({ e }: { e: KlassementEntry }) {
  return (
    <li className="rounded-lg border border-brand-ink/15">
      <details className="group">
        <summary className="flex cursor-pointer items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="w-6 shrink-0 text-center tabular text-brand-ink/50">{e.rank}</span>
          <span className="flex-1 truncate font-medium">{e.displayName}</span>
          <span className="tabular text-sm font-semibold">{e.pointsTotal}</span>
          <span className="text-brand-ink/40 transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <dl className="grid grid-cols-3 gap-2 border-t border-brand-ink/10 px-3 py-2 text-center text-[12px]">
          <Breakdown label="Poule F" value={e.pointsGroupF} />
          <Breakdown label="Overige poules" value={e.pointsOtherGroups} />
          <Breakdown label="Knock-out" value={e.pointsKnockout} />
        </dl>
      </details>
    </li>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-brand-ink/45">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  );
}
