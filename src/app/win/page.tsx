// "Win bij Van Saaze" (prijzenpoule, deelnemerskant). Check in met de dagcode,
// vul de dagvoorspelling in (doelpunten per team per helft), speel mee voor de
// avondprijzen. Losse module; gebruikt loadWinData. Uitleg staat zichtbaar bij
// elk onderdeel (PRIJZENPOULE-PLAN.md §10).
import Link from "next/link";
import { currentParticipant } from "@/lib/participant-auth";
import {
  loadWinData,
  getPrizeTexts,
  loadWinnersOverview,
  loadHoofdprijzen,
  type WinData,
  type PrizeTexts,
  type FrozenEveningWinners,
  type HoofdprijzenData,
} from "@/lib/prijzenpoule-data";
import { DAILY_SCORING } from "@/config/prize-scoring";
import { isDagspelOpen } from "@/lib/predictions-validate";
import { CheckInForm } from "@/components/win/CheckInForm";
import { DailyPredictionForm } from "@/components/win/DailyPredictionForm";

export const dynamic = "force-dynamic";

export default async function WinPage() {
  const participant = await currentParticipant();
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-wide text-brand-accent">Hotel van Saaze</p>
        <h1 className="text-2xl font-bold leading-tight">Win bij Van Saaze</h1>
        <p className="mt-1 text-sm text-brand-ink/60">
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
      <AttendeesBlock names={data.checkedInNames} />
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
      <h2 className="mb-1 text-lg font-extrabold">Winnaars</h2>
      <p className="mb-3 text-[12px] text-brand-ink/55">
        Per afgesloten avond: de dagwinnaar (beste voorspelling) en de Lucky Loser (verloot onder alle
        aanwezigen).
      </p>

      {winners.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-ink/20 p-4 text-center text-[12px] text-brand-ink/55">
          Nog geen afgesloten avonden. Na elke avond verschijnen hier de winnaars.
        </p>
      ) : (
        <ul className="space-y-2">
          {winners.map((w) => (
            <li key={w.id} className="rounded-xl border border-brand-ink/15 bg-white p-3">
              <p className="text-sm font-semibold">{w.label}</p>
              <ul className="mt-1 space-y-0.5 text-[12px]">
                {w.dagspellen.map((d, i) => (
                  <li key={i}>
                    <span className="text-brand-ink/55">{d.matchLabel}:</span>{" "}
                    {d.winnerNames.length ? (
                      <strong>
                        {d.winnerNames.join(", ")}
                        {d.winnerNames.length > 1 ? ` (gedeeld door ${d.winnerNames.length})` : ""}
                      </strong>
                    ) : (
                      <span className="text-brand-ink/45">geen dagwinnaar</span>
                    )}{" "}
                    <span className="text-brand-ink/45">— {prizes.daywinner}</span>
                  </li>
                ))}
                <li>
                  <span className="text-brand-ink/55">Lucky Loser:</span>{" "}
                  <strong>{w.luckyLoserName ?? "—"}</strong>{" "}
                  <span className="text-brand-ink/45">— {prizes.luckyLoser}</span>
                </li>
              </ul>
            </li>
          ))}
        </ul>
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

function AttendeesBlock({ names }: { names: string[] }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold">Wie is er vanavond ({names.length})</h2>
      {names.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-ink/20 p-3 text-center text-[12px] text-brand-ink/55">
          Nog niemand ingecheckt — wees de eerste!
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <li key={n} className="rounded-full bg-wk-field/10 px-2.5 py-1 text-[12px] font-medium text-brand-ink/80">
              {n}
            </li>
          ))}
        </ul>
      )}
    </section>
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
