// Pure scenario logic for the Scenario's tab (Fase 4). No I/O. Two concerns:
//
//  1. Qualification enumeration for Poule F — given the played matches and the
//     remaining ones, enumerate every remaining W/D/L combination and report,
//     per finishing position, whether Nederland is guaranteed / possible /
//     impossible there. Ranking inside the enumeration is points-only: a pure
//     W/D/L combination carries no goal margin, so exact ties between equal-point
//     teams are flagged as "depends on doelsaldo" rather than guessed.
//
//  2. Projection helpers built on current standings: the R32 slot + opponent that
//     follows each Nederland finishing position, and a tournament-wide projected
//     R32 bracket. All "projection on the current standing" — clearly labelled as
//     such in the UI, never presented as fact.
//
// Unit-tested in tests/scenarios.test.ts.

import {
  rankThirdPlaced,
  type StandingRow,
  type StandingTeam,
} from "./standings";
import { R32_SLOTS, resolveThirdPlaceSlots } from "../../prisma/data/r32-allocation";

export type Klass = "zeker" | "mogelijk" | "uitgesloten";

/** One Poule F match as the scenario layer sees it (a finished match carries its
 *  real score; an unfinished one is a remaining fixture the visitor can vary). */
export interface ScenarioMatch {
  id: string;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
}

export interface QualificationSummary {
  remainingCount: number;
  /** position 1..4 -> can Nederland finish exactly there. */
  position: Record<number, Klass>;
  /** Nederland finishes top 2 in *every* remaining outcome (direct qualification). */
  advancementGuaranteed: boolean;
  /** Nederland can still finish last (4th) in at least one outcome. */
  eliminationPossible: boolean;
  /** Some position boundary is a points tie -> the real outcome depends on doelsaldo. */
  tieDependent: boolean;
}

/** Outcome deltas (home, away) for a single match: home win / draw / away win. */
const OUTCOMES: ReadonlyArray<readonly [number, number]> = [
  [3, 0],
  [1, 1],
  [0, 3],
];

/**
 * Enumerate every remaining W/D/L combination of the Poule F matches and classify,
 * for each finishing position 1..4, whether Nederland is guaranteed there ("zeker"),
 * possible ("mogelijk") or impossible ("uitgesloten"). Points-only ranking; equal
 * points produce a position range and set `tieDependent`.
 */
export function summariseGroupF(
  teams: StandingTeam[],
  matches: ScenarioMatch[],
  nlId: string,
): QualificationSummary {
  // Base points from the already-finished matches.
  const base = new Map<string, number>(teams.map((t) => [t.id, 0]));
  for (const m of matches) {
    if (!m.finished || m.homeScore == null || m.awayScore == null) continue;
    if (m.homeScore > m.awayScore) base.set(m.homeId, (base.get(m.homeId) ?? 0) + 3);
    else if (m.homeScore < m.awayScore) base.set(m.awayId, (base.get(m.awayId) ?? 0) + 3);
    else {
      base.set(m.homeId, (base.get(m.homeId) ?? 0) + 1);
      base.set(m.awayId, (base.get(m.awayId) ?? 0) + 1);
    }
  }

  const remaining = matches.filter((m) => !m.finished);
  const n = remaining.length;

  const possible: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false };
  // A position is "guaranteed" only if it is Nederland's sole possible position in
  // every combination; start true and clear it whenever a combination disagrees.
  const guaranteed: Record<number, boolean> = { 1: true, 2: true, 3: true, 4: true };
  let advancementGuaranteed = true;
  let eliminationPossible = false;
  let tieDependent = false;

  const total = 3 ** n;
  for (let combo = 0; combo < total; combo++) {
    const pts = new Map(base);
    let c = combo;
    for (let i = 0; i < n; i++) {
      const [dh, da] = OUTCOMES[c % 3];
      c = Math.floor(c / 3);
      const m = remaining[i];
      pts.set(m.homeId, (pts.get(m.homeId) ?? 0) + dh);
      pts.set(m.awayId, (pts.get(m.awayId) ?? 0) + da);
    }

    const nl = pts.get(nlId) ?? 0;
    let above = 0;
    let tied = 0;
    for (const [id, p] of pts) {
      if (id === nlId) continue;
      if (p > nl) above++;
      else if (p === nl) tied++;
    }
    const bestRank = above + 1;
    const worstRank = above + tied + 1;
    if (tied > 0) tieDependent = true;
    if (worstRank > 2) advancementGuaranteed = false;
    if (worstRank === 4 || (bestRank <= 4 && worstRank >= 4)) eliminationPossible = true;

    for (let p = 1; p <= 4; p++) {
      const inRange = p >= bestRank && p <= worstRank;
      if (inRange) possible[p] = true;
      // guaranteed[p] survives only if THIS combo pins Nederland to exactly p.
      if (!(bestRank === p && worstRank === p)) guaranteed[p] = false;
    }
  }

  const position: Record<number, Klass> = {};
  for (let p = 1; p <= 4; p++) {
    position[p] = guaranteed[p] ? "zeker" : possible[p] ? "mogelijk" : "uitgesloten";
  }

  return {
    remainingCount: n,
    position,
    advancementGuaranteed,
    eliminationPossible,
    tieDependent,
  };
}

export interface ProjectedTeamRef {
  team: StandingTeam | null;
  label: string;
}

export interface NlPathResult {
  position: number;
  qualifies: boolean;
  slot: string | null;
  matchNumber: number | null;
  opponent: ProjectedTeamRef | null;
  /** True for the 3rd-place route (slot depends on which nr. 3's qualify). */
  conditional: boolean;
  note?: string;
}

const slotByNumber = new Map(R32_SLOTS.map((s) => [s.matchNumber, s]));

function winnerLabel(letter: string): string {
  return `Winnaar Poule ${letter}`;
}
function runnerUpLabel(letter: string): string {
  return `Nummer 2 Poule ${letter}`;
}

function rankTeam(standings: StandingRow[] | undefined, rank: number): StandingTeam | null {
  return standings?.[rank - 1]?.team ?? null;
}

/**
 * The R32 slot + (projected) opponent that follows a given Nederland finishing
 * position in Poule F, using the current standings of the other groups.
 *  - 1st: FIFA match 75, home 1F vs away 2C.
 *  - 2nd: FIFA match 76, home 1C vs away 2F.
 *  - 3rd: only if Nederland is among the 8 best nr. 3's; the exact slot then
 *    depends on which groups supply the eight 3rd-placed qualifiers (conditional).
 *  - 4th: eliminated.
 */
export function nlR32Path(
  position: number,
  pouleFStandings: StandingRow[],
  otherGroupStandings: Record<string, StandingRow[]>,
): NlPathResult {
  if (position === 1) {
    const s = slotByNumber.get(75)!;
    return {
      position,
      qualifies: true,
      slot: s.bracketSlot,
      matchNumber: 75,
      opponent: { team: rankTeam(otherGroupStandings["C"], 2), label: `${runnerUpLabel("C")} (projectie)` },
      conditional: false,
    };
  }
  if (position === 2) {
    const s = slotByNumber.get(76)!;
    return {
      position,
      qualifies: true,
      slot: s.bracketSlot,
      matchNumber: 76,
      opponent: { team: rankTeam(otherGroupStandings["C"], 1), label: `${winnerLabel("C")} (projectie)` },
      conditional: false,
    };
  }
  if (position === 3) {
    const nlThird = pouleFStandings[2];
    if (!nlThird) {
      return { position, qualifies: false, slot: null, matchNumber: null, opponent: null, conditional: true };
    }
    // Combine Nederland's hypothetical 3rd with the current 3rd's of the other groups.
    const thirds: { groupLetter: string; row: StandingRow }[] = [{ groupLetter: "F", row: nlThird }];
    for (const [letter, st] of Object.entries(otherGroupStandings)) {
      if (st[2]) thirds.push({ groupLetter: letter, row: st[2] });
    }
    const ranked = rankThirdPlaced(thirds);
    const nlRanked = ranked.find((t) => t.groupLetter === "F");
    if (!nlRanked || !nlRanked.qualifies) {
      return {
        position,
        qualifies: false,
        slot: null,
        matchNumber: null,
        opponent: null,
        conditional: true,
        note: "Op basis van de huidige stand zou Nederland als nummer 3 net buiten de acht beste nummers 3 vallen.",
      };
    }
    const qualifyingGroups = ranked.filter((t) => t.qualifies).map((t) => t.groupLetter);
    try {
      const assignment = resolveThirdPlaceSlots(qualifyingGroups); // bracketSlot -> group letter
      const slot = Object.entries(assignment).find(([, g]) => g === "F")?.[0] ?? null;
      const meta = slot ? R32_SLOTS.find((s) => s.bracketSlot === slot) : null;
      const oppLetter = meta?.homeSource.match(/^1([A-L])$/)?.[1] ?? null;
      return {
        position,
        qualifies: true,
        slot,
        matchNumber: meta?.matchNumber ?? null,
        opponent: oppLetter
          ? { team: rankTeam(otherGroupStandings[oppLetter], 1), label: `${winnerLabel(oppLetter)} (projectie)` }
          : null,
        conditional: true,
        note: "Welke wedstrijd het wordt hangt af van welke acht nummers 3 zich plaatsen; dit is de projectie op de huidige stand.",
      };
    } catch {
      return {
        position,
        qualifies: true,
        slot: null,
        matchNumber: null,
        opponent: null,
        conditional: true,
        note: "Nederland plaatst zich als nummer 3; de exacte tegenstander hangt af van de andere poules.",
      };
    }
  }
  // 4th
  return {
    position,
    qualifies: false,
    slot: null,
    matchNumber: null,
    opponent: null,
    conditional: false,
    note: "Als nummer 4 is Nederland uitgeschakeld.",
  };
}

export interface BracketSlotProjection {
  bracketSlot: string;
  matchNumber: number;
  home: ProjectedTeamRef;
  away: ProjectedTeamRef;
}

/**
 * Tournament-wide projected R32 bracket from the current standings of all 12
 * groups. Group-winner / runner-up sources read straight off each group's table;
 * best-3rd slots are resolved through the FIFA combination table using the eight
 * current best nr. 3's. Pure projection — the UI labels it as such.
 */
export function projectR32(groupStandings: Record<string, StandingRow[]>): BracketSlotProjection[] {
  // Resolve the eight best-3rd slots once (slot -> group letter), if computable.
  let thirdSlotToGroup: Record<string, string> = {};
  const thirds = Object.entries(groupStandings)
    .filter(([, st]) => st[2] != null)
    .map(([letter, st]) => ({ groupLetter: letter, row: st[2] }));
  if (thirds.length >= 8) {
    try {
      const qualifyingGroups = rankThirdPlaced(thirds)
        .filter((t) => t.qualifies)
        .map((t) => t.groupLetter);
      thirdSlotToGroup = resolveThirdPlaceSlots(qualifyingGroups);
    } catch {
      thirdSlotToGroup = {};
    }
  }

  const resolveSource = (src: string, bracketSlot: string): ProjectedTeamRef => {
    const direct = src.match(/^([12])([A-L])$/);
    if (direct) {
      const rank = Number(direct[1]);
      const letter = direct[2];
      return {
        team: rankTeam(groupStandings[letter], rank),
        label: rank === 1 ? winnerLabel(letter) : runnerUpLabel(letter),
      };
    }
    if (src.startsWith("3:")) {
      const group = thirdSlotToGroup[bracketSlot];
      if (group) {
        return { team: rankTeam(groupStandings[group], 3), label: `Nummer 3 Poule ${group}` };
      }
      return { team: null, label: `Beste nummer 3 (${src.slice(2)})` };
    }
    return { team: null, label: src };
  };

  return [...R32_SLOTS]
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map((s) => ({
      bracketSlot: s.bracketSlot,
      matchNumber: s.matchNumber,
      home: resolveSource(s.homeSource, s.bracketSlot),
      away: resolveSource(s.awaySource, s.bracketSlot),
    }));
}
