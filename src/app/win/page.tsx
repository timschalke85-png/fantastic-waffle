// "Win bij Van Saaze" (prijzenpoule, deelnemerskant). Check in met de dagcode,
// vul de dagvoorspelling in (doelpunten per team per helft), speel mee voor de
// avondprijzen. Losse module; gebruikt loadWinData. Uitleg staat zichtbaar bij
// elk onderdeel (PRIJZENPOULE-PLAN.md §10).
import Link from "next/link";
import { currentParticipant } from "@/lib/participant-auth";
import { loadWinData, getPrizeTexts, type WinData, type PrizeTexts } from "@/lib/prijzenpoule-data";
import { DAILY_SCORING } from "@/config/prize-scoring";
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
  const [data, prizes] = await Promise.all([loadWinData(participantId), getPrizeTexts()]);

  if (!data.evening) {
    return (
      <div className="rounded-xl border border-dashed border-brand-ink/20 p-6 text-center">
        <p className="text-sm font-medium">Vanavond is er niets te winnen</p>
        <p className="mt-1 text-[12px] text-brand-ink/55">
          Op wedstrijdavonden bij Van Saaze kun je hier inchecken en meespelen. Hou deze pagina in de gaten!
        </p>
      </div>
    );
  }

  const evening = data.evening;
  return (
    <>
      <p className="mb-4 rounded-lg bg-wk-field/10 px-3 py-2 text-[12px] text-brand-ink/75">
        Vanavond: <strong>{evening.label}</strong>
      </p>
      {!data.checkedIn ? <CheckInBlock /> : <CheckedInBlock data={data} prizes={prizes} />}
    </>
  );
}

function CheckInBlock() {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border-2 border-brand-accent/40 bg-brand-accent/10 p-4">
        <h2 className="text-sm font-bold text-brand-accent">Eerst inchecken</h2>
        <p className="mt-1 text-[12px] leading-snug text-brand-ink/80">
          In het restaurant hangt een code (op een bord of kaartje). Voer 'm hieronder in als bewijs dat je
          er bent. Inchecken doet twee dingen: je speelt mee voor de <strong>avondprijzen</strong>, en de
          avond telt mee voor de <strong>hoofdprijs</strong> aan het eind (minimaal 3 avonden aanwezig).
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
          Dagwinnaar (beste voorspelling) wint: <strong>{prizes.daywinner}</strong>. Bij een gelijke stand
          wordt de prijs gedeeld.
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
              locked={new Date(d.kickoffIso).getTime() <= now}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
