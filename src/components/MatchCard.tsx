// Shared match card for the "Vandaag" board and the Poule F hero, so both share
// one visual language (and, later, one place to add the RUST indicator). Live →
// glowing veld-green star; finished → bold final score; upcoming → faded with
// kickoff. Small crests, consistent with the standings cards.
import type { MatchView, TeamLite } from "@/lib/dashboard";
import { fmtTimeAms, fmtDateTimeAms } from "@/lib/format";
import { TeamCrest } from "@/components/TeamCrest";

export function MatchCard({
  m,
  label,
  dateFormat = "time",
}: {
  m: MatchView;
  label?: string | null;
  dateFormat?: "time" | "datetime";
}) {
  const live = m.status === "LIVE";
  const finished = m.status === "FINISHED";
  const showScore = live || finished;
  const kickoff = dateFormat === "datetime" ? fmtDateTimeAms(m.kickoffUtc) : fmtTimeAms(m.kickoffUtc);

  const cardClass = live
    ? "live-glow bg-wk-field text-white"
    : finished
      ? "border border-brand-ink/10 bg-white"
      : "border border-brand-ink/10 bg-white opacity-75"; // upcoming = faded

  return (
    <div className={`rounded-xl p-3 ${cardClass}`}>
      <div className="mb-1.5 flex min-h-[16px] items-center justify-between gap-2">
        {label ? (
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${live ? "text-white/80" : "text-brand-ink/45"}`}>
            {label}
          </span>
        ) : (
          <span />
        )}
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-white">
            <span className="live-pulse inline-block h-2 w-2 rounded-full bg-white" aria-hidden />
            {m.paused ? "RUST" : "LIVE"}
          </span>
        ) : finished ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-ink/40">afgelopen</span>
        ) : (
          <span className="text-sm font-bold tabular text-brand-ink/70">{kickoff}</span>
        )}
      </div>

      <TeamRow team={m.home} goals={showScore ? m.homeScore : null} live={live} />
      <TeamRow team={m.away} goals={showScore ? m.awayScore : null} live={live} />

      {m.halfTimeHome != null && m.halfTimeAway != null && (
        <p className={`mt-1 text-[10px] tabular ${live ? "text-white/70" : "text-brand-ink/45"}`}>
          rust {m.halfTimeHome}–{m.halfTimeAway}
        </p>
      )}
    </div>
  );
}

function TeamRow({ team, goals, live }: { team: TeamLite | null; goals: number | null; live: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <TeamCrest src={team?.crestUrl ?? null} code={team?.fifaCode ?? "?"} />
      <span className="flex-1 truncate text-sm font-bold">{team?.nameNl ?? "n.t.b."}</span>
      {goals != null && (
        <span className={`w-6 text-right text-xl font-extrabold tabular ${live ? "text-white" : "text-brand-ink"}`}>
          {goals}
        </span>
      )}
    </div>
  );
}
