// "Vandaag" scoreboard: every match kicking off today (Europe/Amsterdam), any
// group — live on top, then upcoming, then finished. Cards use the shared
// MatchCard (same visual language as the Poule F hero). No live minute (the data
// model only has status + score). Data + sort come from loadDashboard()/today.ts.
import type { MatchView } from "@/lib/dashboard";
import { fmtRelativeNl } from "@/lib/format";
import { MatchCard } from "@/components/MatchCard";

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
            <MatchCard m={m} label={label(m)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
