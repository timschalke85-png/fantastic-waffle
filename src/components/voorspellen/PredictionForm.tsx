"use client";

// The /voorspellen form. Mobile-first, autosaves per section (debounced) via the
// server actions, which re-validate everything independently. Progress bar +
// per-group completion badges. Other-group accordions are collapsed by default.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PredictionFormData, FormGroup } from "@/lib/predictions";
import type { SessionParticipant } from "@/lib/participant-auth";
import {
  saveGroupMatchesAction,
  saveTeamGoalsAction,
  saveRankAction,
  logoutAction,
  updateProfileAction,
  type SaveResult,
} from "@/app/voorspellen/actions";
// Exacte puntwaarden uit de centrale config (CLAUDE.md Hard rule 4 — nooit hardcoden).
import { POULE_F, OTHER_GROUPS } from "@/config/scoring";

/** Short, friendly one-liner explaining a section + its points. Solid Saaze-green
 *  block with white text so it springs out against the white poule card; the bold
 *  point numbers stay high-contrast (white-bold on dark green). */
function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 rounded-lg bg-wk-field px-3 py-2 text-[11px] font-medium leading-snug text-white">
      {children}
    </p>
  );
}

type Status = "idle" | "saving" | "saved" | "error";

/** Debounced autosave: fires `save` 800ms after `dep` (a serialized slice) changes,
 *  skipping the initial mount. Always reads the latest `save` closure. */
function useAutosave(dep: string, save: () => Promise<SaveResult>): Status {
  const [status, setStatus] = useState<Status>("idle");
  const saveRef = useRef(save);
  saveRef.current = save;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("saving");
    const id = setTimeout(() => {
      saveRef.current().then((r) => setStatus(r.ok ? "saved" : "error"));
    }, 800);
    return () => clearTimeout(id);
  }, [dep]);
  return status;
}

function SaveBadge({ status }: { status: Status }) {
  const map: Record<Status, { t: string; c: string }> = {
    idle: { t: "", c: "" },
    saving: { t: "Opslaan…", c: "text-brand-ink/40" },
    saved: { t: "Opgeslagen", c: "text-green-700" },
    error: { t: "Niet opgeslagen", c: "text-red-600" },
  };
  const { t, c } = map[status];
  return t ? <span className={`text-[11px] ${c}`}>{t}</span> : null;
}

const numeric = (s: string) => s.replace(/[^0-9]/g, "").slice(0, 2);

interface CountReport {
  (id: string, filled: number, total: number): void;
}

export function PredictionForm({ data, participant }: { data: PredictionFormData; participant: SessionParticipant }) {
  const [counts, setCounts] = useState<Record<string, { filled: number; total: number }>>({});
  const report = useCallback<CountReport>((id, filled, total) => {
    setCounts((prev) => {
      const cur = prev[id];
      if (cur && cur.filled === filled && cur.total === total) return prev;
      return { ...prev, [id]: { filled, total } };
    });
  }, []);

  const { filled, total } = useMemo(() => {
    let f = 0;
    let t = 0;
    for (const c of Object.values(counts)) {
      f += c.filled;
      t += c.total;
    }
    return { filled: f, total: t };
  }, [counts]);
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);

  if (data.locked) {
    return <LockedView data={data} participant={participant} />;
  }

  return (
    <div>
      {/* Account bar */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-brand-ink px-4 py-2.5 text-white">
        <span className="text-sm">
          Ingelogd als <strong>{participant.nickname}</strong>
        </span>
        <form action={logoutAction}>
          <button className="text-xs text-white/70 underline">Uitloggen</button>
        </form>
      </div>

      {/* Progress */}
      <div className="sticky top-[44px] z-[5] mb-4 rounded-lg border border-brand-ink/15 bg-brand-surface/95 p-3 backdrop-blur">
        <div className="mb-1 flex items-center justify-between text-xs text-brand-ink/60">
          <span>Voortgang</span>
          <span className="tabular">
            {filled}/{total} ingevuld
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-brand-ink/10">
          <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Poule F hero sections */}
      <section className="mb-4 rounded-xl border-2 border-brand-accent/60 bg-brand-accent/5 p-4">
        <h2 className="mb-3 text-sm font-semibold">
          <span className="mr-2 rounded bg-brand-accent px-2 py-0.5 text-white">Poule F</span>
          De groep van Oranje
        </h2>
        <MatchesSection group={data.pouleF} existing={data.existing.groupMatch} report={report} idPrefix="F" />
        <TeamGoalsSection group={data.pouleF} existing={data.existing.teamGoals} report={report} />
        <RankSection group={data.pouleF} positions={[1, 2, 3, 4]} existing={data.existing.rank} report={report} />
      </section>

      {/* Other groups */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-ink/60">Overige poules</h2>
      <div className="space-y-2">
        {data.otherGroups.map((g) => (
          <GroupAccordion key={g.letter} group={g} existing={data.existing} report={report} />
        ))}
      </div>

      <ProfileEditor participant={participant} />

      <p className="mt-6 text-center text-[11px] text-brand-ink/50">
        Alleen je bijnaam is zichtbaar voor anderen, tenzij je zelf je naam toont. Dit is een spel onder
        vrienden, geen kansspel.
      </p>
    </div>
  );
}

/* ---- Sections ---- */

function totoLabel(home: string, away: string, homeName: string, awayName: string): string {
  if (home === "" || away === "") return "—";
  const h = Number(home);
  const a = Number(away);
  if (h > a) return `${homeName} wint`;
  if (h < a) return `${awayName} wint`;
  return "Gelijkspel";
}

function MatchesSection({
  group,
  existing,
  report,
  idPrefix,
}: {
  group: FormGroup;
  existing: Record<string, { home: number; away: number }>;
  report: CountReport;
  idPrefix: string;
}) {
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>(() =>
    Object.fromEntries(
      group.matches.map((m) => [
        m.id,
        existing[m.id] ? { home: String(existing[m.id].home), away: String(existing[m.id].away) } : { home: "", away: "" },
      ]),
    ),
  );

  const sectionId = `matches:${group.letter}`;
  const filled = group.matches.filter((m) => {
    const s = scores[m.id];
    return s && s.home !== "" && s.away !== "";
  }).length;
  useEffect(() => report(sectionId, filled, group.matches.length), [filled, group.matches.length, report, sectionId]);

  const dep = JSON.stringify(scores);
  const status = useAutosave(dep, () =>
    // Only send still-editable matches; a kicked-off match is read-only here and
    // the server would reject it (match_locked) anyway.
    saveGroupMatchesAction(
      group.matches
        .filter((m) => !m.locked)
        .map((m) => ({ matchId: m.id, home: scores[m.id]?.home ?? "", away: scores[m.id]?.away ?? "" })),
    ),
  );

  const set = (id: string, side: "home" | "away", v: string) =>
    setScores((p) => ({ ...p, [id]: { ...p[id], [side]: numeric(v) } }));

  if (group.matches.length === 0) {
    return <p className="text-[11px] text-brand-ink/50">Geen voorspelbare wedstrijden in deze poule (alle wedstrijden vóór de deadline).</p>;
  }

  const cfg = group.letter === "F" ? POULE_F.match : OTHER_GROUPS.match;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-ink/60">Uitslagen</h3>
        <SaveBadge status={status} />
      </div>
      <SectionHint>
        Voorspel de exacte uitslag van elke wedstrijd. Exact goed: <strong>{cfg.exactScore} punten</strong> ·
        juiste uitslag (winst/gelijk/verlies): <strong>{cfg.correctOutcome} punten</strong>.
      </SectionHint>
      <ul className="space-y-2">
        {group.matches.map((m) => {
          const s = scores[m.id] ?? { home: "", away: "" };
          if (m.locked) {
            // Kicked-off (or past the deadline): read-only, shows the saved pick.
            return (
              <li key={m.id} className="text-sm opacity-70" data-prefix={idPrefix}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-right">{m.homeName}</span>
                  <span className="w-10 text-center tabular font-semibold">{s.home !== "" ? s.home : "–"}</span>
                  <span className="text-brand-ink/40">–</span>
                  <span className="w-10 text-center tabular font-semibold">{s.away !== "" ? s.away : "–"}</span>
                  <span className="flex-1 truncate">{m.awayName}</span>
                </div>
                <p className="mt-0.5 text-center text-[10px] text-brand-ink/40">op slot — wedstrijd begonnen</p>
              </li>
            );
          }
          return (
            <li key={m.id} className="text-sm" data-prefix={idPrefix}>
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-right">{m.homeName}</span>
                <input
                  aria-label={`${m.homeName} doelpunten`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={s.home}
                  onChange={(e) => set(m.id, "home", e.target.value)}
                  className="w-10 rounded border border-brand-ink/20 px-1 py-1 text-center tabular"
                />
                <span className="text-brand-ink/40">–</span>
                <input
                  aria-label={`${m.awayName} doelpunten`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={s.away}
                  onChange={(e) => set(m.id, "away", e.target.value)}
                  className="w-10 rounded border border-brand-ink/20 px-1 py-1 text-center tabular"
                />
                <span className="flex-1 truncate">{m.awayName}</span>
              </div>
              <p className="mt-0.5 text-center text-[10px] text-brand-ink/45">
                {totoLabel(s.home, s.away, m.homeName, m.awayName)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TeamGoalsSection({
  group,
  existing,
  report,
}: {
  group: FormGroup;
  existing: Record<string, number>;
  report: CountReport;
}) {
  const [goals, setGoals] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.teams.map((t) => [t.id, existing[t.id] != null ? String(existing[t.id]) : ""])),
  );
  const sectionId = `goals:${group.letter}`;
  const filled = group.teams.filter((t) => goals[t.id] !== "").length;
  useEffect(() => report(sectionId, filled, group.teams.length), [filled, group.teams.length, report, sectionId]);

  const dep = JSON.stringify(goals);
  const status = useAutosave(dep, () =>
    saveTeamGoalsAction(group.teams.map((t) => ({ teamId: t.id, goals: goals[t.id] ?? "" }))),
  );

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-ink/60">Doelpunten per land (3 wedstrijden)</h3>
        <SaveBadge status={status} />
      </div>
      <SectionHint>
        Voorspel hoeveel doelpunten elk land in totaal maakt over zijn drie groepswedstrijden.{" "}
        <strong>{POULE_F.teamGoalsExact} punten</strong> per land dat je exact goed hebt.
      </SectionHint>
      <ul className="grid grid-cols-2 gap-2">
        {group.teams.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{t.nameNl}</span>
            <input
              aria-label={`${t.nameNl} totaal doelpunten`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={goals[t.id] ?? ""}
              onChange={(e) => setGoals((p) => ({ ...p, [t.id]: numeric(e.target.value) }))}
              className="w-12 rounded border border-brand-ink/20 px-1 py-1 text-center tabular"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankSection({
  group,
  positions,
  existing,
  report,
}: {
  group: FormGroup;
  positions: number[];
  existing: Record<string, string>;
  report: CountReport;
}) {
  const [picks, setPicks] = useState<Record<number, string>>(() =>
    Object.fromEntries(positions.map((p) => [p, existing[`${group.letter}:${p}`] ?? ""])),
  );
  const sectionId = `rank:${group.letter}`;
  const filled = positions.filter((p) => picks[p] !== "").length;
  useEffect(() => report(sectionId, filled, positions.length), [filled, positions.length, report, sectionId]);

  const dep = JSON.stringify(picks);
  const status = useAutosave(dep, () =>
    saveRankAction({
      groupLetter: group.letter,
      entries: positions.map((p) => ({ position: p, teamId: picks[p] ?? "" })),
    }),
  );

  const chosen = new Set(Object.values(picks).filter((v) => v !== ""));
  const set = (pos: number, teamId: string) => setPicks((p) => ({ ...p, [pos]: teamId }));
  const label = positions.length > 2 ? "Eindstand (1–4)" : "Nr. 1 en nr. 2";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-ink/60">{label}</h3>
        <SaveBadge status={status} />
      </div>
      {group.letter === "F" ? (
        <SectionHint>
          Voorspel de volgorde van de poule (1 t/m 4). <strong>{POULE_F.standing.perCorrectPosition} punten</strong>{" "}
          per juiste positie, plus <strong>{POULE_F.standing.allFourBonus} bonus</strong> als alle vier kloppen.
        </SectionHint>
      ) : (
        <SectionHint>
          Voorspel wie als 1e en 2e eindigt. <strong>{OTHER_GROUPS.standing.correctFirst} punten</strong> voor de
          juiste nr. 1 en <strong>{OTHER_GROUPS.standing.correctSecond} punten</strong> voor de juiste nr. 2.
        </SectionHint>
      )}
      <ul className="space-y-1.5">
        {positions.map((pos) => (
          <li key={pos} className="flex items-center gap-2 text-sm">
            <span className="w-12 shrink-0 text-brand-ink/60">Nr. {pos}</span>
            <select
              aria-label={`Poule ${group.letter} nummer ${pos}`}
              value={picks[pos] ?? ""}
              onChange={(e) => set(pos, e.target.value)}
              className="flex-1 rounded border border-brand-ink/20 bg-white px-2 py-1.5"
            >
              <option value="">— kies team —</option>
              {group.teams.map((t) => (
                <option key={t.id} value={t.id} disabled={chosen.has(t.id) && picks[pos] !== t.id}>
                  {t.nameNl}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupAccordion({
  group,
  existing,
  report,
}: {
  group: FormGroup;
  existing: PredictionFormData["existing"];
  report: CountReport;
}) {
  const [open, setOpen] = useState(false);
  // Local badge: track this group's own counts mirror via a small state.
  const [local, setLocal] = useState<Record<string, { filled: number; total: number }>>({});
  const localReport = useCallback<CountReport>(
    (id, filled, total) => {
      setLocal((prev) => {
        const cur = prev[id];
        if (cur && cur.filled === filled && cur.total === total) return prev;
        return { ...prev, [id]: { filled, total } };
      });
      report(id, filled, total);
    },
    [report],
  );
  const gFilled = Object.values(local).reduce((a, c) => a + c.filled, 0);
  const gTotal = Object.values(local).reduce((a, c) => a + c.total, 0);
  const complete = gTotal > 0 && gFilled === gTotal;

  return (
    <div className="rounded-lg border border-brand-ink/15">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">Poule {group.letter}</span>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              complete ? "bg-green-100 text-green-800" : "bg-brand-ink/5 text-brand-ink/55"
            }`}
          >
            {gFilled}/{gTotal}
          </span>
          <span className="text-brand-ink/40">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-brand-ink/10 px-3 py-3">
          <MatchesSection group={group} existing={existing.groupMatch} report={localReport} idPrefix={group.letter} />
          <RankSection group={group} positions={[1, 2]} existing={existing.rank} report={localReport} />
        </div>
      )}
    </div>
  );
}

function ProfileEditor({ participant }: { participant: SessionParticipant }) {
  return (
    <details className="mt-6 rounded-lg border border-brand-ink/15 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Profiel & naam tonen</summary>
      <form action={updateProfileAction} className="mt-3 space-y-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Volledige naam (optioneel)</span>
          <input
            name="fullName"
            defaultValue={participant.fullName ?? ""}
            maxLength={60}
            className="w-full rounded border border-brand-ink/20 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showFullName" defaultChecked={participant.showFullName} className="h-4 w-4" />
          <span>Toon mijn volledige naam op het klassement</span>
        </label>
        <button className="rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white">Opslaan</button>
      </form>
    </details>
  );
}

/* ---- Locked (deadline passed) read-only view ---- */

function LockedView({ data, participant }: { data: PredictionFormData; participant: SessionParticipant }) {
  const groups = [data.pouleF, ...data.otherGroups];
  return (
    <div>
      <div className="mb-4 rounded-lg bg-red-600 px-4 py-3 text-white">
        <p className="text-sm font-semibold">Deadline verstreken</p>
        <p className="text-[12px] text-white/85">
          De groepsvoorspellingen zijn gesloten. Hieronder staan jouw opgeslagen voorspellingen ({participant.nickname}).
        </p>
      </div>
      {groups.map((g) => (
        <section key={g.letter} className="mb-4 rounded-lg border border-brand-ink/15 p-3">
          <h3 className="mb-2 text-sm font-semibold">Poule {g.letter}</h3>
          {g.matches.length > 0 ? (
            <ul className="mb-2 space-y-1 text-sm">
              {g.matches.map((m) => {
                const p = data.existing.groupMatch[m.id];
                return (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-right">{m.homeName}</span>
                    <span className="w-12 text-center tabular">{p ? `${p.home}–${p.away}` : "—"}</span>
                    <span className="flex-1 truncate">{m.awayName}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[11px] text-brand-ink/45">Geen voorspelbare wedstrijden.</p>
          )}
          <div className="text-[12px] text-brand-ink/70">
            {(g.letter === "F" ? [1, 2, 3, 4] : [1, 2]).map((pos) => {
              const teamId = data.existing.rank[`${g.letter}:${pos}`];
              const team = g.teams.find((t) => t.id === teamId);
              return (
                <span key={pos} className="mr-3">
                  Nr.{pos}: <strong>{team?.nameNl ?? "—"}</strong>
                </span>
              );
            })}
          </div>
          {g.letter === "F" && (
            <div className="mt-1 text-[12px] text-brand-ink/70">
              {g.teams.map((t) => (
                <span key={t.id} className="mr-3">
                  {t.nameNl}: <strong>{data.existing.teamGoals[t.id] ?? "—"}</strong> doelpunten
                </span>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
