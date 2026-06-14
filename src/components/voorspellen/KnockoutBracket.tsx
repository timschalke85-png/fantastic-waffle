"use client";

// Knockout picker (Fase 6, Stap 4). Round-by-round (mobile-first tabs), one card
// per tie. The participant builds THEIR OWN bracket: R32 teams are the real,
// read-only teams; every later round shows the teams resolved from the user's own
// winner-picks (resolveTie) — real results are never shown here (Q4). The winner
// that advances is derived from the predicted scoreline; a winner-selector only
// appears on a draw (ET/penalties). Changing an outcome that invalidates later
// picks pops a confirmation dialog (round + teams) before they are cleared
// (policy B). Debounced autosave, consistent with the group form. The server
// (saveKnockoutPickAction) re-validates and re-derives everything regardless.
import { useEffect, useMemo, useRef, useState } from "react";
import { KO_STAGE_OF } from "../../../prisma/data/ko-bracket";
import {
  resolveTie,
  wouldClear,
  type R32Teams,
  type Picks,
  type TieTeams,
} from "@/lib/knockout-bracket";
import type { KnockoutData, KnockoutTeam } from "@/lib/knockout-data";
import { saveKnockoutPickAction, type KnockoutPickInput } from "@/app/voorspellen/actions";
import { TeamCrest } from "@/components/TeamCrest";

type Status = "idle" | "saving" | "saved" | "error";

interface Cell {
  home: string;
  away: string;
  drawWinner: string; // chosen winner on a draw (ET/penalties); "" otherwise
}
type Cells = Record<number, Cell>;

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ALL_SLOTS = range(73, 104);

const STAGE_NL: Record<string, string> = {
  R32: "Zestiende finale",
  R16: "Achtste finale",
  QF: "Kwartfinale",
  SF: "Halve finale",
  THIRD_PLACE: "Troostfinale",
  FINAL: "Finale",
};

const ROUNDS = [
  { key: "R32", title: "Zestiende finale", short: "1/16", slots: range(73, 88) },
  { key: "R16", title: "Achtste finale", short: "1/8", slots: range(89, 96) },
  { key: "QF", title: "Kwartfinale", short: "Kwart", slots: range(97, 100) },
  { key: "SF", title: "Halve finale", short: "Halve", slots: [101, 102] },
  { key: "FIN", title: "Troost & finale", short: "Finale", slots: [103, 104] },
];

const numeric = (s: string) => s.replace(/[^0-9]/g, "").slice(0, 2);
const emptyCell = (): Cell => ({ home: "", away: "", drawWinner: "" });

/** The winner that advances from a tie, given the predicted cell. Decisive score
 *  -> the higher side; draw -> the explicit drawWinner; incomplete -> none. */
function effWinner(cell: Cell | undefined, tie: TieTeams): string | null {
  if (!cell || !tie.home || !tie.away) return null;
  if (cell.home === "" || cell.away === "") return null;
  const h = Number(cell.home);
  const a = Number(cell.away);
  if (h > a) return tie.home;
  if (a > h) return tie.away;
  return cell.drawWinner || null;
}

/** Engine Picks (winner per slot) derived from the cells, resolving top-down. */
function derivePicks(cells: Cells, r32: R32Teams): Picks {
  const picks: Picks = {};
  const memo = new Map<number, TieTeams>();
  for (const slot of ALL_SLOTS) {
    const tie = resolveTie(slot, r32, picks, memo);
    const w = effWinner(cells[slot], tie);
    if (w) picks[slot] = w; // downstream slots read this winner from `picks` directly
  }
  return picks;
}

function initialCells(existing: KnockoutData["existing"]): Cells {
  const cells: Cells = {};
  for (const [slotStr, p] of Object.entries(existing)) {
    const slot = Number(slotStr);
    const draw = p.homeGoals != null && p.homeGoals === p.awayGoals;
    cells[slot] = {
      home: p.homeGoals != null ? String(p.homeGoals) : "",
      away: p.awayGoals != null ? String(p.awayGoals) : "",
      drawWinner: draw && p.winnerTeamId ? p.winnerTeamId : "",
    };
  }
  return cells;
}

export function KnockoutBracket({ data }: { data: KnockoutData }) {
  const r32 = data.r32;
  const teams = data.teams;
  const [cells, setCells] = useState<Cells>(() => initialCells(data.existing));
  const [activeRound, setActiveRound] = useState("R32");
  const [status, setStatus] = useState<Status>("idle");
  const [pending, setPending] = useState<{ slots: number[] } | null>(null);

  const picks = useMemo(() => derivePicks(cells, r32), [cells, r32]);
  const tieOf = useMemo(() => {
    const memo = new Map<number, TieTeams>();
    const m: Record<number, TieTeams> = {};
    for (const slot of ALL_SLOTS) m[slot] = resolveTie(slot, r32, picks, memo);
    return m;
  }, [picks, r32]);

  const payload: KnockoutPickInput[] = useMemo(
    () =>
      Object.keys(cells).map((slotStr) => {
        const slot = Number(slotStr);
        const c = cells[slot];
        return {
          bracketSlot: slotStr,
          homeGoals: c.home,
          awayGoals: c.away,
          winnerTeamId: effWinner(c, tieOf[slot]) ?? "",
        };
      }),
    [cells, tieOf],
  );
  const dep = JSON.stringify(payload);

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const savedCells = useRef(cells); // last successfully-persisted, consistent cells
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (pending) return; // hold while the confirm dialog is open
    setStatus("saving");
    const id = setTimeout(() => {
      const toClear = wouldClear(r32, derivePicks(cellsRef.current, r32));
      if (toClear.length > 0) {
        setStatus("idle");
        setPending({ slots: toClear });
        return;
      }
      saveKnockoutPickAction(payload).then((r) => {
        setStatus(r.ok ? "saved" : "error");
        if (r.ok) savedCells.current = cellsRef.current;
      });
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  const setCell = (slot: number, patch: Partial<Cell>) =>
    setCells((prev) => ({ ...prev, [slot]: { ...(prev[slot] ?? emptyCell()), ...patch } }));

  const teamName = (id: string | null | undefined) => (id && teams[id] ? teams[id].nameNl : "n.t.b.");

  const confirmClear = () => {
    if (!pending) return;
    setCells((prev) => {
      const next = { ...prev };
      for (const s of pending.slots) next[s] = emptyCell(); // send empty -> server clears the row
      return next;
    });
    setPending(null);
  };
  const cancelClear = () => {
    setCells(savedCells.current); // revert to the last consistent saved state
    setPending(null);
  };

  // Q6 gate: the whole picker is blocked until every R32 tie is known.
  if (!data.r32Complete) {
    return (
      <div className="rounded-xl bg-brand-ink/[0.03] p-5 text-center ring-1 ring-brand-ink/10">
        <p className="text-sm font-semibold text-brand-ink/70">Bracket nog niet beschikbaar</p>
        <p className="mt-1 text-[12px] text-brand-ink/55">
          De knock-out wordt klaargezet zodra alle tegenstanders van de zestiende finales bekend zijn. Kom
          straks terug — je kunt dan je volledige bracket invullen.
        </p>
      </div>
    );
  }

  const round = ROUNDS.find((r) => r.key === activeRound)!;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-brand-ink/60">
          Jouw bracket. De winnaar volgt uit je voorspelde uitslag; bij gelijkspel kies je wie doorgaat.
        </p>
        <SaveBadge status={status} />
      </div>

      <RoundTabs active={activeRound} onSelect={setActiveRound} />

      <h3 className="mb-2 text-sm font-semibold">{round.title}</h3>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {round.slots.map((slot) => (
          <MatchCard
            key={slot}
            slot={slot}
            tie={tieOf[slot]}
            cell={cells[slot] ?? emptyCell()}
            teams={teams}
            readonlyTeams={slot >= 73 && slot <= 88}
            onCell={(patch) => setCell(slot, patch)}
          />
        ))}
      </ul>

      {pending && (
        <CascadeDialog
          slots={pending.slots}
          r32={r32}
          savedCells={savedCells.current}
          teamName={teamName}
          onConfirm={confirmClear}
          onCancel={cancelClear}
        />
      )}
    </div>
  );
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

function MatchCard({
  slot,
  tie,
  cell,
  teams,
  readonlyTeams,
  onCell,
}: {
  slot: number;
  tie: TieTeams;
  cell: Cell;
  teams: Record<string, KnockoutTeam>;
  readonlyTeams: boolean;
  onCell: (patch: Partial<Cell>) => void;
}) {
  const stage = STAGE_NL[KO_STAGE_OF[slot]] ?? "";
  const home = tie.home ? teams[tie.home] : null;
  const away = tie.away ? teams[tie.away] : null;
  const known = !!home && !!away;

  const filled = cell.home !== "" && cell.away !== "";
  const isDraw = filled && cell.home === cell.away;
  const winner = effWinner(cell, tie);

  return (
    <li
      className={`rounded-xl border p-3 shadow-sm transition-colors ${
        winner ? "border-brand-accent/50 bg-white" : known ? "border-brand-ink/20 bg-white" : "border-brand-ink/10 bg-brand-ink/[0.03]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-ink/45">
          {stage} <span className="text-brand-ink/30">· wedstrijd {slot}</span>
        </span>
        {readonlyTeams && known && (
          <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-ink/45">
            vastgesteld
          </span>
        )}
      </div>

      {!known ? (
        <p className="py-2 text-center text-[12px] text-brand-ink/45">
          Nog te bepalen — vul eerst de vorige ronde in.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center justify-end gap-2 truncate text-right">
              <span className={`truncate text-sm ${winner === home!.id ? "font-extrabold text-brand-ink" : "font-bold text-brand-ink/80"}`}>
                {home!.nameNl}
              </span>
              <TeamCrest src={home!.crestUrl} code={home!.fifaCode} />
            </span>
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-ink/15 bg-white px-1.5 py-1 shadow-inner">
              <input
                aria-label={`${home!.nameNl} doelpunten`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={cell.home}
                onChange={(e) => onCell({ home: numeric(e.target.value) })}
                className="h-10 w-10 rounded-md border border-transparent bg-brand-ink/5 text-center text-xl font-extrabold tabular text-brand-ink outline-none focus:border-brand-accent focus:bg-white"
              />
              <span className="text-brand-ink/30">–</span>
              <input
                aria-label={`${away!.nameNl} doelpunten`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={cell.away}
                onChange={(e) => onCell({ away: numeric(e.target.value) })}
                className="h-10 w-10 rounded-md border border-transparent bg-brand-ink/5 text-center text-xl font-extrabold tabular text-brand-ink outline-none focus:border-brand-accent focus:bg-white"
              />
            </div>
            <span className="flex flex-1 items-center gap-2 truncate">
              <TeamCrest src={away!.crestUrl} code={away!.fifaCode} />
              <span className={`truncate text-sm ${winner === away!.id ? "font-extrabold text-brand-ink" : "font-bold text-brand-ink/80"}`}>
                {away!.nameNl}
              </span>
            </span>
          </div>

          {isDraw ? (
            <div className="mt-2 rounded-lg bg-wk-field/5 p-2">
              <p className="mb-1.5 text-center text-[11px] font-medium text-brand-ink/60">
                Gelijkspel — wie gaat door na verlenging/penalty&apos;s?
              </p>
              <div className="flex gap-2">
                {[home!, away!].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onCell({ drawWinner: t.id })}
                    aria-pressed={cell.drawWinner === t.id}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${
                      cell.drawWinner === t.id
                        ? "border-brand-accent bg-brand-accent text-white"
                        : "border-brand-ink/15 bg-white text-brand-ink/70 hover:border-brand-accent/40"
                    }`}
                  >
                    <TeamCrest src={t.crestUrl} code={t.fifaCode} />
                    <span className="truncate">{t.nameNl}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            winner && (
              <div className="mt-2 flex justify-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-brand-accent">
                  {teams[winner]?.nameNl} gaat door
                </span>
              </div>
            )
          )}
        </>
      )}
    </li>
  );
}

function CascadeDialog({
  slots,
  r32,
  savedCells,
  teamName,
  onConfirm,
  onCancel,
}: {
  slots: number[];
  r32: R32Teams;
  savedCells: Cells;
  teamName: (id: string | null | undefined) => string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Describe each pick being removed from the LAST CONSISTENT (saved) state, so
  // the labels read as the user last had them: "round: X wint van Y".
  const oldPicks = derivePicks(savedCells, r32);
  const rows = slots.map((slot) => {
    const tie = resolveTie(slot, r32, oldPicks);
    const w = oldPicks[slot];
    const other = w === tie.home ? tie.away : tie.home;
    const stage = STAGE_NL[KO_STAGE_OF[slot]] ?? `Wedstrijd ${slot}`;
    return w ? `${stage}: ${teamName(w)} wint van ${teamName(other)}` : stage;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl ring-1 ring-brand-ink/10">
        <h4 className="text-base font-extrabold text-brand-ink">Latere voorspellingen vervallen</h4>
        <p className="mt-1 text-[12px] text-brand-ink/60">
          Door deze wijziging kloppen de volgende voorspellingen niet meer en worden ze gewist:
        </p>
        <ul className="my-3 max-h-48 space-y-1.5 overflow-y-auto text-[12px]">
          {rows.map((r, i) => (
            <li key={i} className="rounded-md bg-brand-accent/5 px-2.5 py-1.5 font-medium text-brand-ink/80">
              {r}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-brand-ink/20 px-3 py-2 text-sm font-semibold text-brand-ink/70 hover:bg-brand-ink/5"
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-brand-accent px-3 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Doorgaan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Round tab bar (shared by the editable + read-only views) ---- */

function RoundTabs({ active, onSelect }: { active: string; onSelect: (k: string) => void }) {
  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Knock-out rondes">
      {ROUNDS.map((r) => (
        <button
          key={r.key}
          role="tab"
          aria-selected={r.key === active}
          onClick={() => onSelect(r.key)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide transition-colors ${
            r.key === active
              ? "bg-brand-accent text-white shadow-sm"
              : "bg-brand-accent/10 text-brand-ink/70 hover:bg-brand-accent/20"
          }`}
        >
          {r.short}
        </button>
      ))}
    </div>
  );
}

/* ---- Read-only / locked view (after knockout_lock_utc) ---- */

// Frozen bracket: no inputs, no autosave, no cascade. The participant's saved
// picks are shown, with R16+ teams resolved from their own winner-picks via the
// SAME engine path as the editable view (derivePicks + resolveTie), so a known
// downstream team renders correctly instead of "nog te bepalen".
export function KnockoutBracketReadonly({ data }: { data: KnockoutData }) {
  const r32 = data.r32;
  const teams = data.teams;
  const [activeRound, setActiveRound] = useState("R32");

  const cells = useMemo(() => initialCells(data.existing), [data.existing]);
  const picks = useMemo(() => derivePicks(cells, r32), [cells, r32]);
  const tieOf = useMemo(() => {
    const memo = new Map<number, TieTeams>();
    const m: Record<number, TieTeams> = {};
    for (const slot of ALL_SLOTS) m[slot] = resolveTie(slot, r32, picks, memo);
    return m;
  }, [picks, r32]);

  const hasPicks = Object.keys(data.existing).length > 0;
  const round = ROUNDS.find((r) => r.key === activeRound)!;

  return (
    <div>
      <div className="mb-3 rounded-lg bg-red-600 px-4 py-3 text-white">
        <p className="text-sm font-semibold">Deadline verstreken</p>
        <p className="text-[12px] text-white/85">
          De knock-out voorspelronde is gesloten. Hieronder staat je opgeslagen bracket — wijzigen kan niet meer.
        </p>
      </div>

      {!hasPicks ? (
        <p className="rounded-xl bg-brand-ink/[0.03] p-5 text-center text-[12px] text-brand-ink/55 ring-1 ring-brand-ink/10">
          Je hebt geen knock-out voorspellingen opgeslagen.
        </p>
      ) : (
        <>
          <RoundTabs active={activeRound} onSelect={setActiveRound} />
          <h3 className="mb-2 text-sm font-semibold">{round.title}</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {round.slots.map((slot) => (
              <ReadonlyCard key={slot} slot={slot} tie={tieOf[slot]} cell={cells[slot]} teams={teams} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ReadonlyCard({
  slot,
  tie,
  cell,
  teams,
}: {
  slot: number;
  tie: TieTeams;
  cell: Cell | undefined;
  teams: Record<string, KnockoutTeam>;
}) {
  const stage = STAGE_NL[KO_STAGE_OF[slot]] ?? "";
  const home = tie.home ? teams[tie.home] : null;
  const away = tie.away ? teams[tie.away] : null;
  const known = !!home && !!away;
  const filled = !!cell && cell.home !== "" && cell.away !== "";
  const winner = cell ? effWinner(cell, tie) : null;

  return (
    <li
      className={`rounded-xl border p-3 shadow-sm ${
        known ? "border-brand-ink/20 bg-white" : "border-brand-ink/10 bg-brand-ink/[0.03]"
      }`}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-brand-ink/45">
        {stage} <span className="text-brand-ink/30">· wedstrijd {slot}</span>
      </p>

      {!known ? (
        <p className="py-1 text-center text-[12px] text-brand-ink/40">Niet voorspeld.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center justify-end gap-2 truncate text-right">
              <span className={`truncate text-sm ${winner === home!.id ? "font-extrabold text-brand-ink" : "font-bold text-brand-ink/70"}`}>
                {home!.nameNl}
              </span>
              <TeamCrest src={home!.crestUrl} code={home!.fifaCode} />
            </span>
            <span className="shrink-0 rounded-lg border border-brand-ink/15 bg-white px-3 py-1 text-center text-lg font-extrabold tabular text-brand-ink shadow-inner">
              {filled ? `${cell!.home}–${cell!.away}` : "—"}
            </span>
            <span className="flex flex-1 items-center gap-2 truncate">
              <TeamCrest src={away!.crestUrl} code={away!.fifaCode} />
              <span className={`truncate text-sm ${winner === away!.id ? "font-extrabold text-brand-ink" : "font-bold text-brand-ink/70"}`}>
                {away!.nameNl}
              </span>
            </span>
          </div>
          {winner && (
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-brand-accent">
                {teams[winner]?.nameNl} gaat door
              </span>
            </div>
          )}
        </>
      )}
    </li>
  );
}
