// "Win bij Van Saaze" (prijzenpoule, deelnemerskant). Check in met de dagcode,
// vul de dagvoorspelling in (doelpunten per team per helft), speel mee voor de
// avondprijzen. Losse module; gebruikt loadWinData. Uitleg staat zichtbaar bij
// elk onderdeel (PRIJZENPOULE-PLAN.md §10).
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { TeamCrest } from "@/components/TeamCrest";
import { currentParticipant } from "@/lib/participant-auth";
import {
  loadWinData,
  getPrizeTexts,
  loadWinnersOverview,
  loadHoofdprijzen,
  type WinData,
  type PrizeTexts,
  type RankedPerson,
  type WinnerDagspel,
  type FrozenEveningWinners,
  type HoofdprijzenData,
} from "@/lib/prijzenpoule-data";
import { DAILY_SCORING } from "@/config/prize-scoring";
import { isDagspelOpen } from "@/lib/predictions-validate";
import { fmtDateAms } from "@/lib/format";
import { CheckInForm } from "@/components/win/CheckInForm";
import { DailyPredictionForm } from "@/components/win/DailyPredictionForm";

export const dynamic = "force-dynamic";

export default async function WinPage() {
  const participant = await currentParticipant();
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        {/* Branded strip, consistent with the Overzicht hero (olive chrome + logo chip). */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-olive px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 items-center rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
              <BrandLogo className="h-8 w-auto" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-white/70">Hotel van Saaze</p>
              <h1 className="text-lg font-bold leading-tight">Win bij Van Saaze</h1>
            </div>
          </div>
          <span className="shrink-0 text-2xl" aria-hidden>
            🏆
          </span>
        </div>
        <p className="mt-2 text-sm text-brand-ink/60">
          Kom kijken in het restaurant, check in en speel mee voor de avondprijzen.
        </p>
      </header>

      {!participant ? <NotSignedIn /> : <Loaded participantId={participant.id} />}
    </main>
  );
}

function NotSignedIn() {
  return (
    <div className="rounded-xl border border-brand-ink/15 bg-white p-4">
      <p className="text-sm">Log eerst in met je bijnaam om mee te doen voor de prijzen.</p>
      <Link
        href="/voorspellen"
        className="mt-3 inline-block rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
      >
        Naar inloggen
      </Link>
    </div>
  );
}

async function Loaded({ participantId }: { participantId: string }) {
  const [data, prizes, winners, hoofdprijzen] = await Promise.all([
    loadWinData(participantId),
    getPrizeTexts(),
    loadWinnersOverview(),
    loadHoofdprijzen(),
  ]);

  return (
    <>
      {data.evening ? <TonightBlock data={data} prizes={prizes} /> : <NoEvening />}
      <WinnersSection winners={winners} hoofdprijzen={hoofdprijzen} prizes={prizes} />
    </>
  );
}

function NoEvening() {
  return (
    <div className="rounded-xl border border-dashed border-brand-ink/20 p-6 text-center">
      <p className="text-sm font-medium">Vanavond is er niets te winnen</p>
      <p className="mt-1 text-[12px] text-brand-ink/55">
        Op wedstrijdavonden bij Van Saaze kun je hier inchecken en meespelen. Hou deze pagina in de gaten!
      </p>
    </div>
  );
}

function TonightBlock({ data, prizes }: { data: WinData; prizes: PrizeTexts }) {
  const evening = data.evening!;
  return (
    <>
      <p className="mb-4 rounded-lg bg-wk-field/10 px-3 py-2 text-[12px] text-brand-ink/75">
        Vanavond: <strong>{evening.label}</strong>
      </p>
      {!data.checkedIn ? <CheckInBlock prizes={prizes} /> : <CheckedInBlock data={data} prizes={prizes} />}
      <StrijdersBlock attendees={data.attendees} />
    </>
  );
}

function WinnersSection({
  winners,
  hoofdprijzen,
  prizes,
}: {
  winners: FrozenEveningWinners[];
  hoofdprijzen: HoofdprijzenData;
  prizes: PrizeTexts;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-extrabold">
        <TrophyIcon className="h-5 w-5 text-brand-accent" />
        Winnaars
      </h2>
      <p className="mb-4 text-[12px] text-brand-ink/55">
        Per afgesloten avond: de dagwinnaar (beste voorspelling) en de Lucky Loser (verloot onder alle
        aanwezigen).
      </p>

      {winners.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-ink/20 p-4 text-center text-[12px] text-brand-ink/55">
          Nog geen afgesloten avonden. Na elke avond verschijnen hier de winnaars.
        </p>
      ) : (
        <div className="divide-y divide-brand-ink/10 overflow-hidden rounded-2xl border border-brand-ink/10 bg-white shadow-sm">
          {winners.map((w) => (
            <article key={w.id} className="p-4 sm:p-5">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-accent">{w.label}</p>
                {w.dagspellen[0] && (
                  <p className="shrink-0 text-[11px] text-brand-ink/45">{fmtDateAms(w.dagspellen[0].kickoffIso)}</p>
                )}
              </div>
              <div className="space-y-4">
                {w.dagspellen.map((d, i) => (
                  <div key={i} className="space-y-2.5">
                    <MatchHeadline d={d} />
                    <DagwinnaarBlock winners={d.winners} prize={prizes.daywinner} />
                  </div>
                ))}
                <LuckyLoserBlock person={w.luckyLoser} prize={prizes.luckyLoser} />
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Hoofdprijzen eindblok */}
      <div className="mt-4 rounded-xl border-2 border-brand-accent/40 bg-brand-accent/10 p-4">
        <h3 className="text-sm font-bold text-brand-accent">Hoofdprijzen (eindklassement)</h3>
        <p className="mt-1 text-[12px] leading-snug text-brand-ink/80">
          Aan het eind van het toernooi gaan de hoofdprijzen naar de hoogst geëindigde deelnemers in het
          klassement die <strong>minimaal {hoofdprijzen.minEvenings} avonden</strong> aanwezig waren. Dit is
          pas definitief na de laatste wedstrijd.
        </p>
        <ol className="mt-2 space-y-1 text-sm">
          {[prizes.first, prizes.second, prizes.third].map((prijs, i) => {
            const w = hoofdprijzen.winners.find((x) => x.rank === i + 1);
            return (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-center font-extrabold tabular text-brand-ink/50">{i + 1}</span>
                <span className="flex-1 font-bold">
                  {w ? w.nickname : <span className="font-normal text-brand-ink/40">nog niet bepaald</span>}
                </span>
                <span className="text-[12px] text-brand-ink/60">{prijs}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Eye-catcher per dagspel: crests, the big scoreboard result, the date. */
function MatchHeadline({ d }: { d: WinnerDagspel }) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-brand-olive/10 via-white to-wk-orange/10 px-3 py-3 ring-1 ring-brand-ink/5">
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <span className="flex flex-1 items-center justify-end gap-2 text-right text-sm font-bold leading-tight">
          <span className="truncate">{d.homeName}</span>
          <TeamCrest src={d.homeCrest} code={d.homeCode} />
        </span>
        <span className="shrink-0 rounded-lg bg-brand-ink px-3 py-1 text-xl font-extrabold tabular text-white shadow-sm">
          {d.finished ? `${d.homeScore} – ${d.awayScore}` : "–"}
        </span>
        <span className="flex flex-1 items-center gap-2 text-left text-sm font-bold leading-tight">
          <TeamCrest src={d.awayCrest} code={d.awayCode} />
          <span className="truncate">{d.awayName}</span>
        </span>
      </div>
      <p className="mt-2 text-center text-[11px] text-brand-ink/50">{fmtDateAms(d.kickoffIso)}</p>
    </div>
  );
}

function DagwinnaarBlock({ winners, prize }: { winners: RankedPerson[]; prize: string }) {
  const shared = winners.length > 1;
  return (
    <div className="rounded-xl border border-green-700/15 bg-green-50/70 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <TrophyIcon className="h-4 w-4 text-green-700" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-green-800">
          Dagwinnaar{shared ? "s" : ""}
        </span>
        <span className="ml-auto text-right text-[11px] font-medium text-brand-ink/60">{prize}</span>
      </div>
      {winners.length === 0 ? (
        <p className="mt-1.5 text-sm text-brand-ink/45">Geen dagwinnaar deze avond.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {winners.map((p) => (
            <li key={p.nickname} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <strong>{p.nickname}</strong>
              <RankPill p={p} />
            </li>
          ))}
          {shared && <li className="text-[11px] text-brand-ink/45">gedeeld door {winners.length}</li>}
        </ul>
      )}
    </div>
  );
}

function LuckyLoserBlock({ person, prize }: { person: RankedPerson | null; prize: string }) {
  return (
    <div className="rounded-xl border border-brand-copper/25 bg-brand-copper/[0.07] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <SparkleIcon className="h-4 w-4 text-brand-copper" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-brand-copper">Lucky Loser</span>
        <span className="ml-auto text-right text-[11px] font-medium text-brand-ink/60">{prize}</span>
      </div>
      {person ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <strong>{person.nickname}</strong>
          <RankPill p={person} />
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-brand-ink/45">—</p>
      )}
    </div>
  );
}

/** "3e · 24 ptn", or a tidy fallback for someone without a leaderboard score. */
function rankLabel(p: RankedPerson): string {
  if (p.rank == null || p.points == null) return "nog geen punten";
  return `${p.rank}e · ${p.points} ptn`;
}

function RankPill({ p }: { p: RankedPerson }) {
  return (
    <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-[11px] text-brand-ink/60">{rankLabel(p)}</span>
  );
}

function StrijdersBlock({ attendees }: { attendees: RankedPerson[] }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <ShieldIcon className="h-4 w-4 text-brand-accent" />
        De strijders van vandaag ({attendees.length})
      </h2>
      {attendees.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-ink/20 p-3 text-center text-[12px] text-brand-ink/55">
          Nog niemand ingecheckt — wees de eerste!
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {attendees.map((a) => (
            <li
              key={a.nickname}
              className="flex items-center gap-1.5 rounded-full bg-wk-field/10 px-2.5 py-1 text-[12px]"
            >
              <span className="font-semibold text-brand-ink/80">{a.nickname}</span>
              <span className="text-brand-ink/25" aria-hidden>
                •
              </span>
              <span className="text-brand-ink/55">{rankLabel(a)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --- Inline icons (single-colour via currentColor) -------------------------

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5l-8-3z" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3M12 13v4M8 21h8M10 21v-2h4v2" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
      <path d="M19 14l.85 2.4L22.5 17l-2.65.85L19 20.5l-.85-2.65L15.5 17l2.65-.6L19 14z" opacity="0.65" />
    </svg>
  );
}

function CheckInBlock({ prizes }: { prizes: PrizeTexts }) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border-2 border-brand-accent/40 bg-brand-accent/10 p-4">
        <h2 className="text-sm font-bold text-brand-accent">Eerst inchecken</h2>
        <p className="mt-1 text-[12px] leading-snug text-brand-ink/80">
          In het restaurant hangt een code (op een bord of kaartje). Voer 'm hieronder in als bewijs dat je
          er bent. Inchecken doet twee dingen: je speelt mee voor de <strong>avondprijzen</strong>, en de
          avond telt mee voor de <strong>hoofdprijs</strong> aan het eind (minimaal 3 avonden aanwezig).
        </p>
        <p className="mt-2 text-[12px] leading-snug text-brand-ink/80">
          En onder <strong>álle aanwezigen</strong> wordt een <strong>Lucky Loser</strong>-prijs verloot
          (<strong>{prizes.luckyLoser}</strong>) — ongeacht je voorspelling. Aanwezig zijn loont dus sowieso.
        </p>
      </div>
      <CheckInForm />
    </section>
  );
}

function CheckedInBlock({ data, prizes }: { data: WinData; prizes: PrizeTexts }) {
  const now = Date.now();
  return (
    <section className="space-y-4">
      <div className="rounded-lg bg-green-600 px-4 py-3 text-white">
        <p className="text-sm font-semibold">✅ Ingecheckt voor vanavond</p>
        <p className="text-[12px] text-white/85">Je doet mee voor de avondprijzen. Veel succes!</p>
      </div>

      <div className="rounded-xl border-2 border-brand-accent/40 bg-brand-accent/10 p-4">
        <h2 className="text-sm font-bold text-brand-accent">Het dagspel</h2>
        <p className="mt-1 text-[12px] leading-snug text-brand-ink/80">
          Voorspel de <strong>doelpunten per team per helft</strong>: hoeveel elk team scoort in de 1e en de
          2e helft. Je kunt het aanpassen tot de aftrap.
        </p>
        <p className="mt-2 rounded-lg bg-wk-field px-3 py-2 text-[11px] font-medium leading-snug text-white">
          Punten: <strong>+{DAILY_SCORING.perExactHalfNumber}</strong> per goed getal (4 stuks),{" "}
          <strong>+{DAILY_SCORING.exactHalfTime}</strong> ruststand exact,{" "}
          <strong>+{DAILY_SCORING.exactFullTime}</strong> eindstand exact,{" "}
          <strong>+{DAILY_SCORING.correctOutcome}</strong> juiste uitslag.
        </p>
        <p className="mt-2 text-[12px] text-brand-ink/70">
          <strong>Dagwinnaar</strong> (beste voorspelling) wint: <strong>{prizes.daywinner}</strong>. Bij een
          gelijke stand wordt de prijs gedeeld.
        </p>
        <p className="mt-1 text-[12px] text-brand-ink/70">
          <strong>Lucky Loser</strong>: onder álle aanwezigen wordt sowieso een prijs verloot
          (<strong>{prizes.luckyLoser}</strong>), ongeacht je voorspelling — meedoen loont dus altijd.
        </p>
      </div>

      {data.dagspellen.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-ink/20 p-5 text-center text-[12px] text-brand-ink/55">
          De wedstrijd van de avond wordt nog bepaald. Kom zo terug om je voorspelling in te vullen.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.dagspellen.map((d) => (
            <DailyPredictionForm
              key={d.eveningMatchId}
              dagspel={d}
              existing={data.existing[d.eveningMatchId]}
              // Locked once the match started: kicked off OR no longer SCHEDULED.
              locked={!isDagspelOpen(new Date(d.kickoffIso), d.status, now)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
