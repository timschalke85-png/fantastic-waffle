import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { loadParticipantsAdmin } from "@/lib/participants-admin";
import {
  loadEveningsAdmin,
  loadEveningWinnersView,
  type AdminEveningRow,
  type EveningWinnersView,
} from "@/lib/prijzenpoule-data";
import { fmtDateTimeAms, fmtRelativeNl } from "@/lib/format";
import { POLL_ENABLED } from "@/config/features";
import {
  loginAction,
  logoutAction,
  updateMatchAction,
  clearOverrideAction,
  updateSettingsAction,
  setKnockoutLockFromR32Action,
  deleteParticipantAction,
  forceRefreshAction,
  recomputeAction,
  createEveningAction,
  setEveningCodeAction,
  activateEveningAction,
  deactivateEveningAction,
  setEveningMatchesAction,
  togglePollAction,
  updatePrizeTextsAction,
  freezeEveningAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function BeheerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (!(await isAdmin())) return <LoginView error={sp.error === "auth"} />;

  const [settings, matches, participants, evenings] = await Promise.all([
    getSettings(),
    prisma.match.findMany({
      include: { homeTeam: true, awayTeam: true },
      orderBy: [{ kickoffUtc: "asc" }],
    }),
    loadParticipantsAdmin(),
    loadEveningsAdmin(),
  ]);

  // Winners per evening: live preview before freezing, stored values after.
  const viewEntries = await Promise.all(
    evenings.map(async (e) => [e.id, await loadEveningWinnersView(e.id)] as const),
  );
  const winnerViews: Record<string, EveningWinnersView | null> = Object.fromEntries(viewEntries);

  // Readable options for assigning a broadcast match to an evening (real matches only).
  const matchOptions = matches.map((m) => ({
    id: m.id,
    label: `${fmtDateTimeAms(m.kickoffUtc)} · ${
      m.groupLetter ? `Poule ${m.groupLetter}` : m.bracketSlot ? `KO ${m.bracketSlot}` : "—"
    } · ${m.homeTeam?.nameNl ?? "n.t.b."} – ${m.awayTeam?.nameNl ?? "n.t.b."}`,
  }));

  // Knock-out readiness hints (informational only — no automatic action).
  const groupMatches = matches.filter((m) => m.stage === "GROUP");
  const groupFinished = groupMatches.filter((m) => m.status === "FINISHED").length;
  const allGroupsDone = groupMatches.length > 0 && groupFinished === groupMatches.length;
  const r32Matches = matches.filter((m) => m.stage === "R32");
  const r32Known = r32Matches.filter((m) => m.homeTeamId && m.awayTeamId).length;
  const r32Complete = r32Known === 16;

  // Two-step delete confirmation: ?confirmDelete=<id> shows a confirm block with
  // the real bijnaam before the irreversible action.
  const confirmTarget = sp.confirmDelete ? participants.find((p) => p.id === sp.confirmDelete) : undefined;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-brand-accent">Hotel van Saaze</p>
          <h1 className="text-2xl font-bold">Beheer</h1>
        </div>
        <form action={logoutAction}>
          <button className="rounded border px-3 py-1.5 text-sm">Uitloggen</button>
        </form>
      </header>

      {/* feedback banners */}
      {sp.at !== undefined && (
        <Banner>
          API-refresh: {sp.refreshed ?? "0"} wedstrijden opgehaald, {sp.updated ?? "0"} bijgewerkt,{" "}
          {sp.skipped ?? "0"} overgeslagen (handmatig). Tijd: {sp.at ? fmtDateTimeAms(sp.at) : "—"}
          {sp.err ? ` — fout: ${sp.err}` : ""}
        </Banner>
      )}
      {sp.saved === "settings" && <Banner>Instellingen opgeslagen.</Banner>}
      {sp.error === "db" && (
        <Banner>Opslaan mislukt — de database was even niet bereikbaar. Probeer het opnieuw.</Banner>
      )}
      {sp.saved === "evening" && <Banner>Avond bijgewerkt.</Banner>}
      {sp.saved === "prizes" && <Banner>Prijs-teksten opgeslagen.</Banner>}
      {sp.error === "evening_label" && <Banner>Geef de avond een label.</Banner>}
      {sp.error === "evening_matches" && <Banner>Kies 1 of 2 wedstrijden voor de avond.</Banner>}
      {sp.saved === "frozen" && <Banner>Avond afgesloten — winnaars vastgelegd.</Banner>}
      {sp.error === "ruststand" && (
        <Banner>Onmogelijke ruststand: een team kan bij rust niet meer goals hebben dan aan het eind.</Banner>
      )}
      {sp.error === "not_finished" && (
        <Banner>Afsluiten kan pas als de uitgezonden wedstrijd(en) afgelopen (FINISHED) zijn.</Banner>
      )}
      {sp.deleted && <Banner>Deelnemer {sp.deleted} is verwijderd.</Banner>}
      {sp.error === "participant" && <Banner>Deelnemer niet gevonden.</Banner>}

      {confirmTarget && (
        <div className="mb-4 rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Deelnemer verwijderen?</p>
          <p className="mt-1 text-[13px] text-red-700">
            Weet je zeker dat je <strong>{confirmTarget.nickname}</strong> wilt verwijderen? Dit verwijdert ook
            al hun voorspellingen en kan niet ongedaan worden gemaakt.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={deleteParticipantAction}>
              <input type="hidden" name="participantId" value={confirmTarget.id} />
              <button className="rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white">
                Ja, verwijder {confirmTarget.nickname}
              </button>
            </form>
            <a href="/beheer" className="rounded border px-3 py-2 text-sm">
              Annuleren
            </a>
          </div>
        </div>
      )}
      {sp.saved === "ko_lock" && <Banner>Knock-out lock gezet op de vroegste R32-aftrap.</Banner>}
      {sp.error === "no_r32" && (
        <Banner>Nog geen R32-wedstrijden in de data — knock-out lock niet gezet.</Banner>
      )}
      {sp.recompute === "noop" && (
        <Banner>Herbereken klassement: nog niet actief (komt in Fase 7).</Banner>
      )}

      {/* actions row */}
      <section className="mb-6 flex flex-wrap gap-3">
        <form action={forceRefreshAction}>
          <button className="rounded bg-brand-accent px-3 py-2 text-sm font-medium text-white">
            Forceer API-refresh
          </button>
        </form>
        <form action={recomputeAction}>
          <button className="rounded border px-3 py-2 text-sm">Herbereken klassement</button>
        </form>
        <span className="self-center text-sm text-brand-ink/60">
          Laatst opgehaald: {fmtRelativeNl(settings.last_api_fetch_utc ?? null)} · provider:{" "}
          {settings.api_provider ?? "—"}
        </span>
      </section>

      {/* settings */}
      <section className="mb-8 rounded border p-4">
        <h2 className="mb-3 font-semibold">Instellingen</h2>
        <form action={updateSettingsAction} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Invoer-deadline / group lock (UTC, ISO)
            <input
              name="group_lock_utc"
              defaultValue={settings.group_lock_utc ?? ""}
              placeholder="2026-06-20T17:00:00Z"
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-sm"
            />
            <span className="mt-1 block text-[11px] text-brand-ink/50">
              Globale deadline waarop invoer sluit (per wedstrijd ook al op kickoff).
            </span>
          </label>
          <label className="text-sm">
            Eligibiliteit-vloer (UTC, ISO)
            <input
              name="group_eligibility_floor_utc"
              defaultValue={settings.group_eligibility_floor_utc ?? ""}
              placeholder="2026-06-14T20:00:00Z"
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-sm"
            />
            <span className="mt-1 block text-[11px] text-brand-ink/50">
              Wedstrijden vanaf deze tijd tellen mee voor punten. <strong>Verplicht</strong> — zonder deze
              waarde faalt de scoring bewust luid.
            </span>
          </label>
          <label className="text-sm">
            Knock-out lock (UTC, ISO)
            <input
              name="knockout_lock_utc"
              defaultValue={settings.knockout_lock_utc ?? ""}
              placeholder="leeg = nog niet gezet"
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="knockout_open"
              defaultChecked={settings.knockout_open === "true"}
            />
            Knock-out voorspelronde open
          </label>
          <div className="sm:col-span-2">
            <button className="rounded bg-brand-ink px-3 py-2 text-sm font-medium text-white">
              Instellingen opslaan
            </button>
          </div>
        </form>
      </section>

      {/* knock-out beheer */}
      <section className="mb-8 rounded border p-4">
        <h2 className="mb-3 font-semibold">Knock-out voorspelronde</h2>

        <div className="mb-3 grid gap-1.5 text-sm">
          <p className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                allGroupsDone ? "bg-green-100 text-green-800" : "bg-brand-ink/5 text-brand-ink/60"
              }`}
            >
              {groupFinished}/{groupMatches.length}
            </span>
            Groepswedstrijden afgelopen
            {allGroupsDone && <span className="text-green-700">— je kunt de knock-out openen</span>}
          </p>
          <p className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                r32Complete ? "bg-green-100 text-green-800" : "bg-brand-ink/5 text-brand-ink/60"
              }`}
            >
              {r32Known}/16
            </span>
            R32-tegenstanders bekend
            {r32Complete && <span className="text-green-700">— bracket is compleet</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form action={setKnockoutLockFromR32Action}>
            <button className="rounded border px-3 py-2 text-sm">
              Stel lock = vroegste R32-aftrap
            </button>
          </form>
          <span className="text-xs text-brand-ink/55">
            Vult <code>knockout_lock_utc</code> uit de data; de handmatige override + open-schakelaar
            staan hierboven bij Instellingen.
          </span>
        </div>
      </section>

      {/* prijzenpoule */}
      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Prijzenpoule</h2>

        {/* Prijs-teksten */}
        <div className="mb-6 rounded border p-4">
          <h3 className="mb-1 text-sm font-semibold">Prijs-teksten</h3>
          <p className="mb-3 text-[11px] text-brand-ink/55">
            Deze teksten verschijnen op /win bij elk onderdeel. Leeg laten = &quot;Wordt nog bekendgemaakt&quot;.
          </p>
          <form action={updatePrizeTextsAction} className="grid gap-3 sm:grid-cols-2">
            {[
              ["prize_text_daywinner", "Dagwinnaar"],
              ["prize_text_luckyloser", "Lucky Loser"],
              ["prize_text_first", "Hoofdprijs nr. 1"],
              ["prize_text_second", "Hoofdprijs nr. 2"],
              ["prize_text_third", "Hoofdprijs nr. 3"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  name={key}
                  defaultValue={settings[key] ?? ""}
                  placeholder="bijv. Van Saaze-voucher €50"
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                />
              </label>
            ))}
            <label className="text-sm">
              Hoofdprijs-eis: minimaal aantal avonden aanwezig
              <input
                name="prize_min_evenings"
                type="number"
                min={1}
                defaultValue={settings.prize_min_evenings ?? "3"}
                className="mt-1 w-24 rounded border px-2 py-1.5 text-sm"
              />
            </label>
            <div className="sm:col-span-2">
              <button className="rounded bg-brand-ink px-3 py-2 text-sm font-medium text-white">
                Prijs-teksten opslaan
              </button>
            </div>
          </form>
        </div>

        {/* Nieuwe avond */}
        <div className="mb-4 rounded border p-4">
          <h3 className="mb-2 text-sm font-semibold">Nieuwe avond</h3>
          <form action={createEveningAction} className="flex flex-wrap gap-2">
            <input
              name="label"
              placeholder="bijv. Avond 1 — za 14 juni"
              className="min-w-[16rem] flex-1 rounded border px-2 py-1.5 text-sm"
            />
            <button className="rounded bg-brand-accent px-3 py-2 text-sm font-medium text-white">
              Avond aanmaken
            </button>
          </form>
        </div>

        {/* Avonden */}
        {evenings.length === 0 ? (
          <p className="text-sm text-brand-ink/55">Nog geen avonden aangemaakt.</p>
        ) : (
          <div className="space-y-3">
            {evenings.map((e) => (
              <EveningCard key={e.id} e={e} matchOptions={matchOptions} view={winnerViews[e.id]} />
            ))}
          </div>
        )}
      </section>

      {/* deelnemers */}
      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Deelnemers ({participants.length})</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-brand-ink/55">Nog geen deelnemers geregistreerd.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-brand-ink/60">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Bijnaam</th>
                  <th className="py-2 pr-2">Geregistreerd</th>
                  <th className="py-2 pr-2">Eerste inzending</th>
                  <th className="py-2 pr-2 text-center">Voorspellingen</th>
                  <th className="py-2 pr-2 text-right">Punten</th>
                  <th className="py-2 pl-2 text-right">Actie</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b align-middle">
                    <td className="py-1.5 pr-2 text-brand-ink/50">{p.rank ?? "—"}</td>
                    <td className="py-1.5 pr-2 font-medium">{p.nickname}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-brand-ink/60">
                      {fmtDateTimeAms(p.createdAtIso)}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-brand-ink/60">
                      {p.firstSubmittedAtIso ? fmtDateTimeAms(p.firstSubmittedAtIso) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-center tabular">
                      {p.predictionCount > 0 ? p.predictionCount : <span className="text-brand-ink/40">geen</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular font-semibold">{p.points ?? "—"}</td>
                    <td className="py-1.5 pl-2 text-right">
                      <a href={`/beheer?confirmDelete=${p.id}`} className="text-xs text-red-600 underline">
                        Verwijderen
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* matches */}
      <section>
        <h2 className="mb-3 font-semibold">Wedstrijden ({matches.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-brand-ink/60">
                <th className="py-2 pr-2">Aftrap (Ams)</th>
                <th className="py-2 pr-2">Poule/Slot</th>
                <th className="py-2 pr-2">Wedstrijd</th>
                <th className="py-2 pr-2">Bewerken</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} className="border-b align-middle">
                  <td className="whitespace-nowrap py-1.5 pr-2">{fmtDateTimeAms(m.kickoffUtc)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-2 text-brand-ink/60">
                    {m.groupLetter ? `Poule ${m.groupLetter}` : m.bracketSlot ? `#${m.bracketSlot}` : "—"}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-2">
                    {(m.homeTeam?.nameNl ?? "—") + " – " + (m.awayTeam?.nameNl ?? "—")}
                    {m.manuallyOverridden && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">
                        handmatig
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={updateMatchAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="matchId" value={m.id} />
                        {/* The rendered status, so the action can tell a real status
                            change from a score-only save (never freeze a stale status). */}
                        <input type="hidden" name="originalStatus" value={m.status} />
                        <select
                          name="status"
                          defaultValue={m.status}
                          className="rounded border px-1.5 py-1 text-sm"
                        >
                          <option value="SCHEDULED">Gepland</option>
                          <option value="LIVE">Live</option>
                          <option value="FINISHED">Afgelopen</option>
                        </select>
                        <input
                          name="homeScore"
                          inputMode="numeric"
                          defaultValue={m.homeScore ?? ""}
                          className="w-12 rounded border px-1.5 py-1 text-center"
                          aria-label="Score thuis"
                        />
                        <span>–</span>
                        <input
                          name="awayScore"
                          inputMode="numeric"
                          defaultValue={m.awayScore ?? ""}
                          className="w-12 rounded border px-1.5 py-1 text-center"
                          aria-label="Score uit"
                        />
                        {(m.status === "LIVE" || m.status === "FINISHED") && (
                          <span className="ml-1 flex items-center gap-1 text-[11px] text-brand-ink/55">
                            rust
                            <input
                              name="halfTimeHome"
                              inputMode="numeric"
                              defaultValue={m.halfTimeHome ?? ""}
                              className="w-10 rounded border px-1.5 py-1 text-center"
                              aria-label="Ruststand thuis"
                            />
                            <span>–</span>
                            <input
                              name="halfTimeAway"
                              inputMode="numeric"
                              defaultValue={m.halfTimeAway ?? ""}
                              className="w-10 rounded border px-1.5 py-1 text-center"
                              aria-label="Ruststand uit"
                            />
                          </span>
                        )}
                        <button className="rounded bg-brand-ink px-2.5 py-1 text-xs font-medium text-white">
                          Opslaan
                        </button>
                      </form>
                      {m.manuallyOverridden && (
                        <form action={clearOverrideAction}>
                          <input type="hidden" name="matchId" value={m.id} />
                          <button className="text-xs text-brand-ink/60 underline">herstel API</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MatchSelect({ defaultValue, options }: { defaultValue: string; options: { id: string; label: string }[] }) {
  return (
    <select name="matchId" defaultValue={defaultValue} className="max-w-[20rem] rounded border px-2 py-1 text-xs">
      <option value="">— geen —</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function EveningCard({
  e,
  matchOptions,
  view,
}: {
  e: AdminEveningRow;
  matchOptions: { id: string; label: string }[];
  view: EveningWinnersView | null;
}) {
  const slot1 = e.dagspellen[0]?.matchId ?? "";
  const slot2 = e.dagspellen[1]?.matchId ?? "";
  return (
    <div className="rounded border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{e.label}</span>
        <span className="flex items-center gap-2 text-xs">
          {e.isActive && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">Actief — vanavond</span>
          )}
          {POLL_ENABLED && e.pollOpen && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Poll open</span>
          )}
          <span className="text-brand-ink/55">{e.checkinCount} ingecheckt</span>
        </span>
      </div>

      {e.checkinNames.length > 0 && (
        <p className="mb-2 text-[11px] text-brand-ink/60">
          <span className="font-medium">Ingecheckt:</span> {e.checkinNames.join(", ")}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {/* Dagcode */}
        <form action={setEveningCodeAction} className="flex items-end gap-1.5">
          <input type="hidden" name="eveningId" value={e.id} />
          <label className="text-xs">
            Dagcode (krijgt men in het restaurant)
            <input
              name="checkInCode"
              defaultValue={e.checkInCode ?? ""}
              placeholder="bv. SAAZE7"
              className="mt-1 block rounded border px-2 py-1 text-sm"
            />
          </label>
          <button className="rounded border px-2.5 py-1.5 text-xs">Code opslaan</button>
        </form>

        {/* Activeren / deactiveren */}
        {e.isActive ? (
          <form action={deactivateEveningAction}>
            <input type="hidden" name="eveningId" value={e.id} />
            <button className="rounded border px-2.5 py-2 text-xs">Deactiveren</button>
          </form>
        ) : (
          <form action={activateEveningAction}>
            <input type="hidden" name="eveningId" value={e.id} />
            <button className="rounded bg-brand-ink px-2.5 py-2 text-xs font-medium text-white">
              Activeer als vanavond
            </button>
          </form>
        )}

        {/* Poll — hidden until the vote UI + outcome logic are built (POLL_ENABLED). */}
        {POLL_ENABLED && (
          <form action={togglePollAction}>
            <input type="hidden" name="eveningId" value={e.id} />
            <input type="hidden" name="open" value={(!e.pollOpen).toString()} />
            <button className="rounded border px-2.5 py-2 text-xs">{e.pollOpen ? "Poll sluiten" : "Poll openen"}</button>
          </form>
        )}
      </div>

      {/* Uitgezonden wedstrijd(en) = de dagspellen */}
      <form action={setEveningMatchesAction} className="mt-3 border-t pt-3">
        <input type="hidden" name="eveningId" value={e.id} />
        <p className="mb-1.5 text-xs font-medium text-brand-ink/70">
          Uitgezonden wedstrijd(en) — kies 1 of 2 (elke wedstrijd = een eigen dagspel):
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <MatchSelect defaultValue={slot1} options={matchOptions} />
          <MatchSelect defaultValue={slot2} options={matchOptions} />
          <button className="rounded bg-brand-accent px-2.5 py-1.5 text-xs font-medium text-white">
            Wedstrijd(en) opslaan
          </button>
        </div>
        {e.dagspellen.length > 0 && (
          <p className="mt-1.5 text-[11px] text-brand-ink/55">Nu aangewezen: {e.dagspellen.map((d) => d.label).join(" · ")}</p>
        )}
      </form>

      {/* Winnaars + afsluiten (freeze) / heropenen */}
      {view?.hasMatches && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-1.5 text-xs font-medium text-brand-ink/70">
            Winnaars{view.frozen ? " (vastgelegd)" : view.allFinished ? " (voorlopig)" : ""}:
          </p>
          {!view.allFinished && !view.frozen ? (
            <p className="text-[11px] text-brand-ink/55">Wedstrijd(en) nog niet afgelopen — afsluiten kan straks.</p>
          ) : (
            <>
              <ul className="space-y-0.5 text-[12px]">
                {view.perMatch.map((pm, i) => (
                  <li key={i}>
                    <span className="text-brand-ink/55">{pm.matchLabel}:</span>{" "}
                    {!pm.scoreable ? (
                      <span className="text-brand-ink/45">geen ruststand-data</span>
                    ) : pm.winnerNames.length ? (
                      <strong>
                        {pm.winnerNames.join(", ")}
                        {pm.winnerNames.length > 1 ? ` (gedeeld door ${pm.winnerNames.length})` : ""}
                      </strong>
                    ) : (
                      <span className="text-brand-ink/45">geen inzendingen</span>
                    )}
                  </li>
                ))}
                <li>
                  <span className="text-brand-ink/55">Lucky Loser:</span>{" "}
                  <strong>{view.luckyLoserName ?? "—"}</strong>
                </li>
              </ul>
              {view.frozen ? (
                <p className="mt-2 text-[11px] font-medium text-green-700">Afgesloten ✓ — vastgelegd</p>
              ) : (
                <form action={freezeEveningAction} className="mt-2">
                  <input type="hidden" name="eveningId" value={e.id} />
                  <button className="rounded bg-brand-ink px-2.5 py-2 text-xs font-medium text-white">
                    Avond afsluiten (winnaars vastleggen)
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-sm">
      {children}
    </div>
  );
}

function LoginView({ error }: { error: boolean }) {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <p className="text-xs uppercase tracking-wide text-brand-accent">Hotel van Saaze</p>
      <h1 className="mb-4 text-2xl font-bold">Beheer — inloggen</h1>
      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Onjuist wachtwoord.
        </p>
      )}
      <form action={loginAction} className="space-y-3">
        <input
          type="password"
          name="password"
          autoFocus
          placeholder="Wachtwoord"
          className="w-full rounded border px-3 py-2"
        />
        <button className="w-full rounded bg-brand-ink px-3 py-2 font-medium text-white">
          Inloggen
        </button>
      </form>
    </main>
  );
}
