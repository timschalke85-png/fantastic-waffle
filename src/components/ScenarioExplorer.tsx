"use client";

// Poule F scenario-verkenner (Fase 4). Fully client-side: the visitor sets
// hypothetical scores for the remaining Group F matches and instantly sees the
// resulting table, Nederland's finishing position, and the R32 slot + projected
// opponent that follows. Recomputation reuses the pure standings + scenario libs,
// so no server round-trip happens on input (acceptance criterion).
import { useMemo, useState } from "react";
import { computeStandings, type StandingRow, type StandingTeam, type FinishedMatch } from "@/lib/standings";
import { nlR32Path } from "@/lib/scenarios";
import type { ScenarioPouleFMatch, ScenarioGroupStanding } from "@/lib/scenario-data";

interface Props {
  teams: StandingTeam[];
  matches: ScenarioPouleFMatch[];
  otherGroups: ScenarioGroupStanding[];
  nlId: string | null;
}

type Input = { home: string; away: string };

function parseGoals(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  return Number.isInteger(n) && n >= 0 && String(n) === t ? n : null;
}

function fmtSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function ScenarioExplorer({ teams, matches, otherGroups, nlId }: Props) {
  // Editable inputs only for the not-yet-finished matches.
  const [inputs, setInputs] = useState<Record<string, Input>>(() =>
    Object.fromEntries(matches.filter((m) => !m.finished).map((m) => [m.id, { home: "", away: "" }])),
  );

  const otherStandingsRecord = useMemo(() => {
    const rec: Record<string, StandingRow[]> = {};
    for (const g of otherGroups) rec[g.letter] = g.standings;
    return rec;
  }, [otherGroups]);

  const { standings, allFilled } = useMemo(() => {
    const finished: FinishedMatch[] = [];
    let filledCount = 0;
    for (const m of matches) {
      if (m.finished && m.homeScore != null && m.awayScore != null) {
        finished.push({ homeTeamId: m.homeId, awayTeamId: m.awayId, homeScore: m.homeScore, awayScore: m.awayScore });
        filledCount++;
        continue;
      }
      const inp = inputs[m.id];
      const h = inp ? parseGoals(inp.home) : null;
      const a = inp ? parseGoals(inp.away) : null;
      if (h != null && a != null) {
        finished.push({ homeTeamId: m.homeId, awayTeamId: m.awayId, homeScore: h, awayScore: a });
        filledCount++;
      }
    }
    return { standings: computeStandings(teams, finished), allFilled: filledCount === matches.length };
  }, [inputs, matches, teams]);

  const nlRow = nlId ? standings.find((r) => r.team.id === nlId) : undefined;
  const path =
    allFilled && nlRow && nlId ? nlR32Path(nlRow.rank, standings, otherStandingsRecord) : null;

  const setInput = (id: string, side: "home" | "away", value: string) =>
    setInputs((prev) => ({ ...prev, [id]: { ...prev[id], [side]: value.replace(/[^0-9]/g, "").slice(0, 2) } }));

  const reset = () =>
    setInputs(Object.fromEntries(matches.filter((m) => !m.finished).map((m) => [m.id, { home: "", away: "" }])));

  const remaining = matches.filter((m) => !m.finished);

  return (
    <section className="rounded-xl border-2 border-brand-accent/60 bg-brand-accent/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          <span className="mr-2 rounded bg-brand-accent px-2 py-0.5 text-white">Poule F</span>
          Scenario-verkenner
        </h2>
        {remaining.length > 0 && (
          <button onClick={reset} className="text-xs text-brand-ink/50 underline">
            Wissen
          </button>
        )}
      </div>

      {remaining.length === 0 ? (
        <p className="mb-3 text-xs text-brand-ink/60">
          Alle wedstrijden in Poule F zijn gespeeld; de eindstand hieronder is definitief.
        </p>
      ) : (
        <p className="mb-3 text-xs text-brand-ink/60">
          Vul hypothetische uitslagen in voor de resterende wedstrijden. De tabel en de route van Oranje
          worden direct herberekend.
        </p>
      )}

      {/* Remaining-match inputs */}
      {remaining.length > 0 && (
        <ul className="mb-4 space-y-2">
          {remaining.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-right">{m.homeName}</span>
              <input
                aria-label={`${m.homeName} doelpunten`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputs[m.id]?.home ?? ""}
                onChange={(e) => setInput(m.id, "home", e.target.value)}
                className="w-10 rounded border border-brand-ink/20 px-1 py-1 text-center tabular"
              />
              <span className="text-brand-ink/40">–</span>
              <input
                aria-label={`${m.awayName} doelpunten`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputs[m.id]?.away ?? ""}
                onChange={(e) => setInput(m.id, "away", e.target.value)}
                className="w-10 rounded border border-brand-ink/20 px-1 py-1 text-center tabular"
              />
              <span className="flex-1 truncate">{m.awayName}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Resulting table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-brand-ink/50">
            <th className="py-1 pr-2 font-medium">#</th>
            <th className="py-1 pr-2 font-medium">Team</th>
            <th className="py-1 px-1 text-center font-medium">G</th>
            <th className="py-1 px-1 text-center font-medium" title="Doelsaldo">DS</th>
            <th className="py-1 px-1 text-center font-medium" title="Doelpunten voor">DV</th>
            <th className="py-1 pl-1 text-center font-medium">Ptn</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((r) => (
            <tr
              key={r.team.id}
              className={`border-t border-brand-ink/10 ${r.team.id === nlId ? "font-semibold" : ""} ${
                r.rank <= 2 ? "" : "text-brand-ink/70"
              }`}
            >
              <td className="py-1.5 pr-2 text-brand-ink/50">{r.rank}</td>
              <td className="py-1.5 pr-2">
                {r.team.nameNl}
                {r.team.id === nlId && <span className="ml-1 text-brand-accent">●</span>}
              </td>
              <td className="px-1 text-center tabular">{r.played}</td>
              <td className="px-1 text-center tabular">{fmtSigned(r.goalDiff)}</td>
              <td className="px-1 text-center tabular">{r.goalsFor}</td>
              <td className="pl-1 text-center tabular font-semibold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Nederland's resulting position + R32 route */}
      <div className="mt-4 rounded-lg bg-white/70 p-3 text-sm">
        {!nlId ? (
          <p className="text-brand-ink/60">Nederland niet gevonden in de data.</p>
        ) : !allFilled ? (
          <p className="text-brand-ink/60">
            Vul alle zes wedstrijden in voor de definitieve eindstand en de R32-route van Oranje.
            {nlRow && <> Voorlopige positie van Nederland: <strong>{nlRow.rank}e</strong>.</>}
          </p>
        ) : path ? (
          <div className="space-y-1">
            <p>
              In dit scenario eindigt Nederland als <strong>{path.position}e</strong> in Poule F.
            </p>
            {path.qualifies ? (
              <>
                <p>
                  Route: <strong>zestiende finale (wedstrijd {path.matchNumber ?? "?"})</strong>
                  {path.opponent && (
                    <>
                      {" "}tegen <strong>{path.opponent.team?.nameNl ?? path.opponent.label}</strong>
                      {path.opponent.team && <span className="text-brand-ink/50"> ({path.opponent.label})</span>}
                    </>
                  )}
                  .
                </p>
                {path.conditional && (
                  <p className="text-[11px] text-brand-ink/50">
                    {path.note ??
                      "Als nummer 3 hangt de exacte tegenstander af van welke acht nummers 3 zich plaatsen."}
                  </p>
                )}
              </>
            ) : (
              <p className="text-brand-ink/70">{path.note ?? "Nederland is in dit scenario uitgeschakeld."}</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
