// "Favorieten van de poule" — pure ranking of who participants predicted as the
// Poule F winner (their nr.1 pick). No I/O (unit-tested). The DB read lives in
// favorites-data.ts. Privacy: counts only, never names; the UI frames it honestly
// as predictions, not a result.

export interface FavoriteCount {
  teamId: string;
  count: number;
  pct: number; // share of the participants who made a Poule F nr.1 pick
}

/** Count nr.1 picks per team and return the top `limit`, with a percentage of the
 *  total picks. Deterministic tie-break by teamId. Pure. */
export function rankFavorites(picks: { teamId: string }[], limit = 3): FavoriteCount[] {
  const total = picks.length;
  const counts = new Map<string, number>();
  for (const p of picks) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([teamId, count]) => ({ teamId, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.teamId.localeCompare(b.teamId))
    .slice(0, limit);
}

export interface FavoriteEntry extends FavoriteCount {
  nameNl: string;
  fifaCode: string;
  crestUrl: string | null;
}

export interface FavoritesData {
  entries: FavoriteEntry[];
  totalPicks: number;
}
