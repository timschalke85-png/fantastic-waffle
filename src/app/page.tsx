// Overzicht (Fase 3). Mobile-first. Poule F is the visually dominant hero,
// always first; the other 11 groups sit in a quieter grid below, plus the
// "Beste nummers 3" widget. Live scores render from the DB (refreshed on load).
import { loadDashboard, type GroupView, type MatchView } from "@/lib/dashboard";
import type { StandingRow } from "@/lib/standings";
import { fmtDateTimeAms, fmtRelativeNl, fmtTimeAms } from "@/lib/format";
import { NextMatchCountdown } from "@/components/NextMatchCountdown";
import { BrandLogo } from "@/components/BrandLogo";
import { LiveDot } from "@/components/LiveDot";
import { BrandFooter } from "@/components/BrandFooter";
import { TeamCrest } from "@/components/TeamCrest";
import { TodayBoard } from "@/components/TodayBoard";
import { FavoritesBlock } from "@/components/FavoritesBlock";
import { loadFavorites } from "@/lib/favorites-data";

export const dynamic = "force-dynamic";

export default async function Overzicht() {
  const [d, favorites] = await Promise.all([loadDashboard(), loadFavorites()]);
  const isLive = d.pouleF.matches.some((m) => m.status === "LIVE");
  const pouleFCountries = d.pouleF.standings.map((r) => r.team.nameNl).join(" · ");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Branded header strip (chrome: olive). Logo degrades to a text wordmark. */}
      <header className="mb-5">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-olive px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            {/* White chip behind the logo so the green-gold mark stays legible on olive. */}
            <span className="flex shrink-0 items-center rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
              <BrandLogo className="h-8 w-auto" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight">Poule F</h1>
              <p className="truncate text-[11px] text-white/70">{pouleFCountries}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <LiveDot live={isLive} />
            <p className="mt-1 text-[10px] text-white/55">Bijgewerkt: {fmtRelativeNl(d.lastFetchUtc)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="rounded-full border border-brand-ink/15 px-3 py-1 text-xs text-brand-ink/70">
            {d.phaseLabel}
          </span>
          <span className="text-[10px] text-brand-ink/40">tijden in Europe/Amsterdam</span>
        </div>

        {/* Two equal colour blocks: favourites (left) + next NL match (right). Stack on mobile. */}
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FavoritesBlock data={favorites} />

          <div className="flex h-full flex-col justify-between rounded-2xl bg-wk-orange px-5 py-4 text-white shadow-sm">
            {d.nextNlMatch ? (
              <>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">
                    Volgende wedstrijd Nederland
                  </p>
                  <p className="truncate text-lg font-bold leading-tight">
                    {teamName(d.nextNlMatch.home)} – {teamName(d.nextNlMatch.away)}
                  </p>
                  <p className="text-[11px] text-white/80">{fmtDateTimeAms(d.nextNlMatch.kickoffUtc)}</p>
                </div>
                <div className="mt-3 text-2xl font-extrabold">
                  <NextMatchCountdown kickoffUtcIso={d.nextNlMatch.kickoffUtc.toISOString()} />
                </div>
              </>
            ) : (
              <p className="text-sm font-medium text-white/90">Geen aankomende wedstrijd voor Nederland.</p>
            )}
          </div>
        </div>
      </header>

      {/* Vandaag — live scoreboard of all of today's matches, prominent on matchdays. */}
      <TodayBoard matches={d.today} lastFetchUtc={d.lastFetchUtc} />

      {/* Poule F hero */}
      <PouleFHero group={d.pouleF} />

      {/* Beste nummers 3 */}
      <BesteNummers3 thirds={d.thirdPlace} fairPlayAvailable={d.fairPlayAvailable} />

      {/* Other groups grid */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-ink/60">
          Overige poules
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {d.otherGroups.map((g) => (
            <GroupCard key={g.letter} group={g} />
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-brand-ink/40">
        Een spel onder vrienden, geen kansspel.
      </p>

      <BrandFooter />
    </main>
  );
}

function teamName(t: MatchView["home"]): string {
  return t?.nameNl ?? "—";
}

function LivePulse() {
  return (
    <span
      className="ml-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 align-middle"
      aria-label="live"
    />
  );
}

function ScoreOrTime({ m }: { m: MatchView }) {
  if (m.status === "SCHEDULED") return <span className="text-brand-ink/60">{fmtTimeAms(m.kickoffUtc)}</span>;
  return (
    <span className="tabular font-semibold">
      {m.homeScore ?? 0}–{m.awayScore ?? 0}
      {m.status === "LIVE" && <LivePulse />}
    </span>
  );
}

function PouleFHero({ group }: { group: GroupView }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-ink/10 bg-white shadow-sm">
      {/* Veld-green hero band anchors the section in the WK energy. */}
      <div className="flex items-center gap-2 bg-wk-field px-4 py-3 text-white">
        <span className="rounded-md bg-white/20 px-2 py-0.5 text-sm font-extrabold">Poule F</span>
        <span className="text-sm font-medium text-white/90">De groep van Oranje</span>
      </div>

      <div className="p-3">
        {/* Column guide */}
        <div className="mb-1.5 flex items-center gap-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-brand-ink/40">
          <span className="w-7 text-center">#</span>
          <span className="w-8" />
          <span className="flex-1">Team</span>
          <span className="w-6 text-center" title="Gespeeld">G</span>
          <span className="w-7 text-center" title="Doelsaldo">DS</span>
          <span className="w-6 text-center" title="Doelpunten voor">DV</span>
          <span className="w-9 text-right">Ptn</span>
        </div>

        {/* Standings as colourful row-cards; Nederland is a full oranje block. */}
        <ol className="space-y-2">
          {group.standings.map((r) => {
            const ned = r.team.fifaCode === "NED";
            const dim = ned ? "text-white/80" : "text-brand-ink/55";
            return (
              <li
                key={r.team.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  ned ? "bg-wk-orange text-white shadow-sm" : "border border-brand-ink/10 bg-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                    ned ? "bg-white/25 text-white" : "bg-brand-ink/5 text-brand-ink/70"
                  }`}
                >
                  {r.rank}
                </span>
                <TeamCrest src={r.team.crestUrl ?? null} code={r.team.fifaCode} />
                <span className="flex-1 truncate font-bold">
                  {r.team.nameNl}
                  {r.decidedByLots && <LotsMark />}
                </span>
                <span className={`w-6 text-center text-xs tabular ${dim}`}>{r.played}</span>
                <span className={`w-7 text-center text-xs tabular ${dim}`}>{fmtSigned(r.goalDiff)}</span>
                <span className={`w-6 text-center text-xs tabular ${dim}`}>{r.goalsFor}</span>
                <span className={`w-9 text-right text-2xl font-extrabold leading-none tabular ${ned ? "text-white" : "text-brand-ink"}`}>
                  {r.points}
                </span>
              </li>
            );
          })}
        </ol>

        {/* The six Group F matches — restyled in Stap C. */}
        <ul className="mt-4 divide-y divide-brand-ink/10 border-t border-brand-ink/10 pt-1">
          {group.matches.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-24 shrink-0 text-[11px] text-brand-ink/50">{fmtDateTimeAms(m.kickoffUtc)}</span>
              <span className="flex-1 truncate text-right">{teamName(m.home)}</span>
              <span className="w-16 shrink-0 text-center">
                <ScoreOrTime m={m} />
              </span>
              <span className="flex-1 truncate">{teamName(m.away)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function GroupCard({ group }: { group: GroupView }) {
  return (
    <div className="rounded-lg border border-brand-ink/15 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Poule {group.letter}</span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {group.standings.map((r) => (
            <tr key={r.team.id} className="border-t border-brand-ink/10 first:border-0">
              <td className="py-1 pr-1 text-brand-ink/40">{r.rank}</td>
              <td className="py-1 pr-1">{r.team.nameNl}</td>
              <td className="py-1 px-1 text-center tabular text-brand-ink/60">{fmtSigned(r.goalDiff)}</td>
              <td className="py-1 pl-1 text-right tabular font-semibold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {group.matches.some((m) => m.status !== "SCHEDULED") && (
        <ul className="mt-2 space-y-0.5 border-t border-brand-ink/10 pt-2 text-[11px]">
          {group.matches
            .filter((m) => m.status !== "SCHEDULED")
            .map((m) => (
              <li key={m.id} className="flex justify-between">
                <span className="truncate">
                  {m.home?.fifaCode}–{m.away?.fifaCode}
                </span>
                <span className="tabular">
                  {m.homeScore ?? 0}–{m.awayScore ?? 0}
                  {m.status === "LIVE" && <LivePulse />}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function BesteNummers3({
  thirds,
  fairPlayAvailable,
}: {
  thirds: { groupLetter: string; row: StandingRow; rank: number; qualifies: boolean }[];
}  & { fairPlayAvailable: boolean }) {
  return (
    <section className="mt-6 rounded-lg border border-brand-ink/15 p-4">
      <h2 className="text-sm font-semibold">Beste nummers 3</h2>
      <p className="mb-2 text-[11px] text-brand-ink/50">
        De acht beste nummers 3 gaan door naar de zestiende finales. Criteria: punten, doelsaldo,
        doelpunten voor{fairPlayAvailable ? ", fair play" : ""}.
        {!fairPlayAvailable && " Fair play-data is niet beschikbaar via de databron; bij gelijke stand beslist loting."}
      </p>
      <ol className="text-sm">
        {thirds.map((t) => (
          <li
            key={t.groupLetter}
            className={`flex items-center gap-2 border-t border-brand-ink/10 py-1.5 ${
              t.qualifies ? "" : "text-brand-ink/40"
            }`}
          >
            <span className="w-5 text-brand-ink/50">{t.rank}</span>
            <span className="w-12 text-[11px] text-brand-ink/50">Poule {t.groupLetter}</span>
            <span className="flex-1">
              {t.row.team.nameNl}
              {t.row.decidedByLots && <LotsMark />}
            </span>
            <span className="tabular text-brand-ink/60">
              {t.row.points} ptn · {fmtSigned(t.row.goalDiff)}
            </span>
            <span className="w-16 text-right text-[11px]">
              {t.qualifies ? <span className="text-green-700">geplaatst</span> : "uit"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LotsMark() {
  return (
    <span className="ml-1 text-[10px] text-brand-ink/40" title="Bij gelijke stand: beslist door loting">
      (loting)
    </span>
  );
}

function fmtSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
