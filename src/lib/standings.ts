// Pure group-standings computation with the full FIFA WC2026 group tiebreaker
// order (CLAUDE.md). No I/O — unit-tested in tests/standings.test.ts.
//
// Tiebreaker order (FIFA, group stage):
//   1. points (all group matches)
//   2. goal difference (all)
//   3. goals scored (all)
//   4. head-to-head among the still-tied teams: points, then GD, then goals,
//      counting only matches between those tied teams
//   5. fair play points  — NOTE: football-data.org does not expose disciplinary
//      data, so fair play is unavailable; treated as equal (0) for everyone and
//      surfaced honestly in the UI.
//   6. drawing of lots — deterministic fallback by FIFA code (flagged so the UI
//      can label a row as provisionally separated by lot).

export interface StandingTeam {
  id: string;
  nameNl: string;
  fifaCode: string;
  crestUrl?: string | null;
}

export interface FinishedMatch {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export interface StandingRow {
  team: StandingTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number; // 1-based final position
  /** Separated from an equal peer only by the drawing-of-lots fallback. */
  decidedByLots: boolean;
}

interface Stat {
  team: StandingTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function emptyStat(team: StandingTeam): Stat {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

function applyResult(s: Stat, gf: number, ga: number): void {
  s.played++;
  s.goalsFor += gf;
  s.goalsAgainst += ga;
  if (gf > ga) {
    s.won++;
    s.points += 3;
  } else if (gf === ga) {
    s.drawn++;
    s.points += 1;
  } else {
    s.lost++;
  }
}

function gd(s: Stat): number {
  return s.goalsFor - s.goalsAgainst;
}

/** Head-to-head mini-table among a set of teams, using only matches between them. */
function headToHead(teamIds: Set<string>, matches: FinishedMatch[]): Map<string, { pts: number; gd: number; gf: number }> {
  const h = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const id of teamIds) h.set(id, { pts: 0, gd: 0, gf: 0 });
  for (const m of matches) {
    if (!teamIds.has(m.homeTeamId) || !teamIds.has(m.awayTeamId)) continue;
    const home = h.get(m.homeTeamId)!;
    const away = h.get(m.awayTeamId)!;
    home.gf += m.homeScore;
    away.gf += m.awayScore;
    home.gd += m.homeScore - m.awayScore;
    away.gd += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore) home.pts += 3;
    else if (m.homeScore < m.awayScore) away.pts += 3;
    else {
      home.pts += 1;
      away.pts += 1;
    }
  }
  return h;
}

/**
 * Compute final, ranked standings for one group. `matches` should be the group's
 * FINISHED matches (both teams known, integer scores). Unplayed matches are
 * simply absent, so early-tournament tables read 0–0–0 for everyone.
 */
export function computeStandings(teams: StandingTeam[], matches: FinishedMatch[]): StandingRow[] {
  const ids = new Set(teams.map((t) => t.id));
  const stats = new Map<string, Stat>(teams.map((t) => [t.id, emptyStat(t)]));

  for (const m of matches) {
    if (!ids.has(m.homeTeamId) || !ids.has(m.awayTeamId)) continue;
    if (!Number.isFinite(m.homeScore) || !Number.isFinite(m.awayScore)) continue;
    applyResult(stats.get(m.homeTeamId)!, m.homeScore, m.awayScore);
    applyResult(stats.get(m.awayTeamId)!, m.awayScore, m.homeScore);
  }

  const arr = [...stats.values()];

  // Primary sort: points, GD, goals.
  arr.sort(
    (a, b) =>
      b.points - a.points ||
      gd(b) - gd(a) ||
      b.goalsFor - a.goalsFor ||
      0,
  );

  // Resolve runs tied on (points, GD, goals) by head-to-head, then lots.
  const lotsSeparated = new Set<string>();
  let i = 0;
  while (i < arr.length) {
    let j = i + 1;
    while (
      j < arr.length &&
      arr[j].points === arr[i].points &&
      gd(arr[j]) === gd(arr[i]) &&
      arr[j].goalsFor === arr[i].goalsFor
    ) {
      j++;
    }
    if (j - i > 1) {
      const tied = arr.slice(i, j);
      const tiedIds = new Set(tied.map((s) => s.team.id));
      const h2h = headToHead(tiedIds, matches);
      tied.sort((a, b) => {
        const ha = h2h.get(a.team.id)!;
        const hb = h2h.get(b.team.id)!;
        return (
          hb.pts - ha.pts ||
          hb.gd - ha.gd ||
          hb.gf - ha.gf ||
          // fair play unavailable (equal) -> drawing of lots, deterministic by code
          a.team.fifaCode.localeCompare(b.team.fifaCode)
        );
      });
      // Flag rows that the H2H criteria did NOT separate (only lots did).
      for (let k = 0; k < tied.length; k++) {
        const cur = tied[k];
        const hc = h2h.get(cur.team.id)!;
        const prev = k > 0 ? tied[k - 1] : null;
        const next = k < tied.length - 1 ? tied[k + 1] : null;
        const equalH2H = (o: Stat | null) =>
          o && (() => { const ho = h2h.get(o.team.id)!; return ho.pts === hc.pts && ho.gd === hc.gd && ho.gf === hc.gf; })();
        if (equalH2H(prev) || equalH2H(next)) lotsSeparated.add(cur.team.id);
      }
      arr.splice(i, tied.length, ...tied);
    }
    i = j;
  }

  return arr.map((s, idx) => ({
    team: s.team,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    goalsFor: s.goalsFor,
    goalsAgainst: s.goalsAgainst,
    goalDiff: gd(s),
    points: s.points,
    rank: idx + 1,
    decidedByLots: lotsSeparated.has(s.team.id),
  }));
}

export interface ThirdPlaceRow {
  groupLetter: string;
  row: StandingRow;
  rank: number; // 1-based across all third-placed teams
  qualifies: boolean; // top 8 advance
}

/**
 * Rank the third-placed teams across groups (CLAUDE.md: points, GD, goals, fair
 * play). Fair play unavailable -> deterministic lots by FIFA code. Top 8 qualify.
 */
export function rankThirdPlaced(
  thirds: { groupLetter: string; row: StandingRow }[],
): ThirdPlaceRow[] {
  const sorted = [...thirds].sort(
    (a, b) =>
      b.row.points - a.row.points ||
      b.row.goalDiff - a.row.goalDiff ||
      b.row.goalsFor - a.row.goalsFor ||
      a.row.team.fifaCode.localeCompare(b.row.team.fifaCode),
  );
  return sorted.map((t, idx) => ({
    groupLetter: t.groupLetter,
    row: t.row,
    rank: idx + 1,
    qualifies: idx < 8,
  }));
}
