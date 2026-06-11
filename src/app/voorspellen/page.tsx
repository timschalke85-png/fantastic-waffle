// Voorspellen (Fase 5). Identity gate first; once signed in, the full prediction
// form (group round). Everything editable until settings.group_lock_utc, then a
// read-only "Deadline verstreken" view. All writes are validated server-side in
// ./actions regardless of the UI.
import { currentParticipant } from "@/lib/participant-auth";
import { loadPredictionForm } from "@/lib/predictions";
import { LoginForm } from "@/components/voorspellen/LoginForm";
import { PredictionForm } from "@/components/voorspellen/PredictionForm";
import { fmtDateTimeAms } from "@/lib/format";
import { isKnockoutOpen, getKnockoutLockUtc } from "@/lib/settings";

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
      <KnockoutPanel />
    </>
  );
}

// Fase 6 framework (test phase): the knockout prediction flow is gated behind
// settings.knockout_open. Until the admin opens it (~28 June, once all group
// matches are final and the R32 teams are known), this is just a status notice.
// The bracket engine (src/lib/knockout-bracket.ts) is built and unit-tested; the
// interactive picker UI is the remainder of Fase 6.
async function KnockoutPanel() {
  const open = await isKnockoutOpen();
  if (!open) {
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
  const lock = await getKnockoutLockUtc();
  return (
    <section className="mt-6 rounded-lg border border-brand-accent/50 p-4">
      <h2 className="text-sm font-semibold">Knock-out voorspelronde — geopend</h2>
      <p className="mt-1 text-[12px] text-brand-ink/55">
        {lock ? <>Bewerkbaar tot {fmtDateTimeAms(lock.toISOString())} (Europe/Amsterdam).</> : "Open."} De
        interactieve bracket-picker wordt in Fase 6 afgerond.
      </p>
    </section>
  );
}
