import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { fmtDateTimeAms, fmtRelativeNl } from "@/lib/format";
import {
  loginAction,
  logoutAction,
  updateMatchAction,
  clearOverrideAction,
  updateSettingsAction,
  forceRefreshAction,
  recomputeAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function BeheerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (!(await isAdmin())) return <LoginView error={sp.error === "auth"} />;

  const [settings, matches] = await Promise.all([
    getSettings(),
    prisma.match.findMany({
      include: { homeTeam: true, awayTeam: true },
      orderBy: [{ kickoffUtc: "asc" }],
    }),
  ]);

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
            Group lock (UTC, ISO)
            <input
              name="group_lock_utc"
              defaultValue={settings.group_lock_utc ?? ""}
              placeholder="2026-06-14T20:00:00Z"
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-sm"
            />
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
