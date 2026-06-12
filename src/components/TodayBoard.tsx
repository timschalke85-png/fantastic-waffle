// "Vandaag" scoreboard: every match kicking off today (Europe/Amsterdam), any
// group — live on top, then upcoming, then finished. Live match gets the glowing
// veld-green treatment. No live minute (the data model only has status + score).
// Data + sort come from loadDashboard()/today.ts; this only renders.
import type { MatchView, TeamLite } from "@/lib/dashboard";
import { fmtTimeAms, fmtRelativeNl } from "@/lib/format";
import { TeamCrest } from "@/components/TeamCrest";

function label(m: MatchView): string {
  return m.groupLetter ? `Poule ${m.groupLetter}` : "Knock-out";
}

export function TodayBoard({ matches, lastFetchUtc }: { matches: MatchView[]; lastFetchUtc: string | null }) {
  // Quiet one-liner on days with no matches — never a big empty board.
  if (matches.length === 0) {
    return <p className="mb-5 text-center text-[12px] text-brand-ink/45">Vandaag geen wedstrijden.</p>;
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold">Vandaag</h2>
        <span className="text-[10px] text-brand-ink/45">bijgewerkt {fmtRelativeNl(lastFetchUtc)}</span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {matches.map((m) => (
          <li key={m.id}>
            <MatchCard m={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MatchCard({ m }: { m: MatchView }) {
  const live = m.status === "LIVE";
  const finished = m.status === "FINISHED";
  const showScore = live || finished;

  return (
    <div
      className={`rounded-xl p-3 ${
        live ? "live-glow bg-wk-field text-white" : "border border-brand-ink/10 bg-white"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${live ? "text-white/80" : "text-brand-ink/45"}`}>
          {label(m)}
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-white">
            <span className="live-pulse inline-block h-2 w-2 rounded-full bg-white" aria-hidden />
            LIVE
          </span>
        ) : finished ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-ink/40">afgelopen</span>
        ) : (
          <span className="text-sm font-bold tabular text-brand-ink/70">{fmtTimeAms(m.kickoffUtc)}</span>
        )}
      </div>

      <TeamRow team={m.home} goals={showScore ? m.homeScore : null} live={live} finished={finished} />
      <TeamRow team={m.away} goals={showScore ? m.awayScore : null} live={live} finished={finished} />
    </div>
  );
}

function TeamRow({
  team,
  goals,
  live,
  finished,
}: {
  team: TeamLite | null;
  goals: number | null;
  live: boolean;
  finished: boolean;
}) {
  const goalTone = live ? "text-white" : finished ? "text-brand-ink/70" : "text-brand-ink";
  return (
    <div className="flex items-center gap-2 py-0.5">
      <TeamCrest src={team?.crestUrl ?? null} code={team?.fifaCode ?? "?"} />
      <span className="flex-1 truncate text-sm font-bold">{team?.nameNl ?? "n.t.b."}</span>
      {goals != null && <span className={`w-6 text-right text-xl font-extrabold tabular ${goalTone}`}>{goals}</span>}
    </div>
  );
}
