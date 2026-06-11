// Scenario's (Fase 4). Three blocks, all built on the current standings:
//  1. Poule F scenario-verkenner (client, instant recompute) — see ScenarioExplorer.
//  2. Kwalificatie-overzicht: enumerated guaranteed/possible/impossible per
//     finishing position for Nederland (pure, computed server-side).
//  3. Geprojecteerde R32-bracket: "Projectie op basis van de huidige stand".
// No predictions are made here; everything is informational.
import { loadScenarioData } from "@/lib/scenario-data";
import { ScenarioExplorer } from "@/components/ScenarioExplorer";
import type { Klass, QualificationSummary, BracketSlotProjection } from "@/lib/scenarios";
import { fmtRelativeNl } from "@/lib/format";

export const dynamic = "force-dynamic";

const POS_NL: Record<number, string> = { 1: "1e — groepswinst", 2: "2e", 3: "3e", 4: "4e" };

const KLASS_STYLE: Record<Klass, { label: string; cls: string }> = {
  zeker: { label: "Zeker", cls: "bg-green-100 text-green-800" },
  mogelijk: { label: "Mogelijk", cls: "bg-amber-100 text-amber-800" },
  uitgesloten: { label: "Uitgesloten", cls: "bg-brand-ink/5 text-brand-ink/40" },
};

export default async function Scenarios() {
  const d = await loadScenarioData();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-wide text-brand-accent">Hotel van Saaze</p>
        <h1 className="text-2xl font-bold leading-tight">Scenario&apos;s</h1>
        <p className="mt-1 text-sm text-brand-ink/60">
          Reken zelf met Poule F en bekijk de geprojecteerde knock-outfase. Dit is informatie, geen voorspelling.
        </p>
        <p className="mt-2 text-[11px] text-brand-ink/50">
          Laatst bijgewerkt: {fmtRelativeNl(d.lastFetchUtc)} · tijden in Europe/Amsterdam
        </p>
      </header>

      <ScenarioExplorer
        teams={d.pouleFTeams}
        matches={d.pouleFMatches}
        otherGroups={d.otherGroups}
        nlId={d.nlId}
      />

      <QualificationSummaryBlock summary={d.summary} />

      <ProjectedBracketBlock bracket={d.projectedBracket} />

      <p className="mt-8 text-center text-xs text-brand-ink/40">Een spel onder vrienden, geen kansspel.</p>
    </main>
  );
}

function QualificationSummaryBlock({ summary }: { summary: QualificationSummary }) {
  return (
    <section className="mt-6 rounded-lg border border-brand-ink/15 p-4">
      <h2 className="text-sm font-semibold">Kwalificatie-overzicht Nederland</h2>
      <p className="mb-3 text-[11px] text-brand-ink/50">
        Berekend door alle {summary.remainingCount === 0 ? "gespeelde" : "nog mogelijke"} uitkomsten
        (winst/gelijk/verlies) van de resterende Poule F-wedstrijden te doorlopen.
      </p>

      {summary.advancementGuaranteed ? (
        <p className="mb-3 rounded bg-green-100 px-3 py-2 text-sm text-green-800">
          Nederland is <strong>zeker van de knock-outfase</strong> (eindigt sowieso bij de eerste twee).
        </p>
      ) : (
        <p className="mb-3 rounded bg-brand-ink/5 px-3 py-2 text-sm text-brand-ink/70">
          Nederland is nog <strong>niet zeker</strong> van directe plaatsing (top 2). Plaatsing als
          nummer 3 kan alsnog via de acht beste nummers 3.
        </p>
      )}

      <ul className="space-y-1.5 text-sm">
        {[1, 2, 3, 4].map((p) => {
          const k = summary.position[p];
          const style = KLASS_STYLE[k];
          return (
            <li key={p} className="flex items-center justify-between border-t border-brand-ink/10 py-1.5">
              <span>Eindigt als {POS_NL[p]}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style.cls}`}>{style.label}</span>
            </li>
          );
        })}
      </ul>

      {summary.tieDependent && (
        <p className="mt-3 text-[11px] text-brand-ink/50">
          Let op: bij een gelijk aantal punten beslist het doelsaldo (en daarna doelpunten voor). Deze
          enumeratie kijkt alleen naar winst/gelijk/verlies, dus exacte posities bij een puntengelijke
          stand hangen af van de uitslagen.
        </p>
      )}
    </section>
  );
}

function TeamCell({ ref }: { ref: BracketSlotProjection["home"] }) {
  if (ref.team) {
    return (
      <span>
        {ref.team.nameNl}
        <span className="ml-1 text-[10px] text-brand-ink/40">{ref.label}</span>
      </span>
    );
  }
  return <span className="text-brand-ink/50">{ref.label}</span>;
}

function ProjectedBracketBlock({ bracket }: { bracket: BracketSlotProjection[] }) {
  return (
    <section className="mt-6 rounded-lg border border-brand-ink/15 p-4">
      <h2 className="text-sm font-semibold">Geprojecteerde zestiende finales</h2>
      <p className="mb-3 text-[11px] text-brand-ink/50">
        Projectie op basis van de huidige stand — nog geen definitieve loting. De acht beste nummers 3
        zijn ingevuld volgens de officiële FIFA-verdeeltabel.
      </p>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {bracket.map((s) => (
          <li key={s.bracketSlot} className="rounded border border-brand-ink/10 p-2 text-sm">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-brand-ink/40">
              Wedstrijd {s.matchNumber}
            </div>
            <div className="flex items-center justify-between gap-2">
              <TeamCell ref={s.home} />
            </div>
            <div className="my-0.5 text-center text-[10px] text-brand-ink/30">vs</div>
            <div className="flex items-center justify-between gap-2">
              <TeamCell ref={s.away} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
