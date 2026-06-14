// Voorspellen (Fase 5). Identity gate first; once signed in, the full prediction
// form (group round). Everything editable until settings.group_lock_utc, then a
// read-only "Deadline verstreken" view. All writes are validated server-side in
// ./actions regardless of the UI.
import { currentParticipant } from "@/lib/participant-auth";
import { loadPredictionForm } from "@/lib/predictions";
import { loadKnockoutData } from "@/lib/knockout-data";
import { LoginForm } from "@/components/voorspellen/LoginForm";
import { PredictionForm } from "@/components/voorspellen/PredictionForm";
import { KnockoutBracket, KnockoutBracketReadonly } from "@/components/voorspellen/KnockoutBracket";
import { fmtDateTimeAms } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Voorspellen({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const participant = await currentParticipant();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-wide text-brand-accent">Hotel van Saaze</p>
        <h1 className="text-2xl font-bold leading-tight">Voorspellen</h1>
        <p className="mt-1 text-sm text-brand-ink/60">Groepsfase. Vul in wat je kunt — onvolledig opslaan mag altijd.</p>
      </header>

      {sp.saved === "profiel" && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">Profiel opgeslagen.</p>
      )}

      {!participant ? (
        <LoginForm error={sp.error} />
      ) : (
        <Loaded participantId={participant.id} participant={participant} />
      )}
    </main>
  );
}

async function Loaded({
  participantId,
  participant,
}: {
  participantId: string;
  participant: Awaited<ReturnType<typeof currentParticipant>>;
}) {
  const data = await loadPredictionForm(participantId);
  return (
    <>
      {data.lockIso && !data.locked && (
        <p className="mb-4 text-[12px] text-brand-ink/55">
          Bewerkbaar tot de deadline: <strong>{fmtDateTimeAms(data.lockIso)}</strong> (Europe/Amsterdam).
        </p>
      )}
      <PredictionForm data={data} participant={participant!} />
      <KnockoutPanel participantId={participantId} />
    </>
  );
}

// Knock-out voorspelronde (Fase 6). Gated behind settings.knockout_open. Once the
// admin opens it (~28 June, all group matches final + R32 known), the interactive
// picker is shown; after knockout_lock_utc it becomes a frozen read-only view of
// the participant's saved bracket. All writes are re-validated server-side too.
async function KnockoutPanel({ participantId }: { participantId: string }) {
  const data = await loadKnockoutData(participantId);
  if (!data.open) {
    return (
      <section className="mt-6 rounded-lg border border-dashed border-brand-ink/20 p-4">
        <h2 className="text-sm font-semibold">Knock-out voorspelronde</h2>
        <p className="mt-1 text-[12px] text-brand-ink/55">
          Nog niet geopend. Deze ronde opent zodra alle groepswedstrijden gespeeld zijn en de zestiende
          finales bekend zijn (rond 28 juni). Je krijgt dan bericht en kunt hier je volledige knock-out
          bracket invullen.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-6 rounded-xl border-2 border-brand-accent/60 bg-brand-accent/5 p-4">
      <h2 className="mb-1 text-sm font-semibold">
        <span className="mr-2 rounded bg-brand-accent px-2 py-0.5 text-white">Knock-out</span>
        Voorspelronde — {data.locked ? "gesloten" : "geopend"}
      </h2>
      {data.lockIso && !data.locked && (
        <p className="mb-3 text-[12px] text-brand-ink/55">
          Bewerkbaar tot {fmtDateTimeAms(data.lockIso)} (Europe/Amsterdam).
        </p>
      )}
      {data.locked ? <KnockoutBracketReadonly data={data} /> : <KnockoutBracket data={data} />}
    </section>
  );
}
