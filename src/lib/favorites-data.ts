// Server loader for the Favorieten block (read-only; no refresh needed). Reads
// Poule F nr.1 picks (teamId only — no participant identity) and enriches the
// pure ranking with team display data.
import "server-only";
import { prisma } from "./db";
import { rankFavorites, type FavoriteEntry, type FavoritesData } from "./favorites";

export async function loadFavorites(): Promise<FavoritesData> {
  const picks = await prisma.predictionGroupRank.findMany({
    where: { groupLetter: "F", position: 1 },
    select: { teamId: true },
  });
  const ranked = rankFavorites(picks, 3);
  if (ranked.length === 0) return { entries: [], totalPicks: 0 };

  const teams = await prisma.team.findMany({
    where: { id: { in: ranked.map((r) => r.teamId) } },
    select: { id: true, nameNl: true, fifaCode: true, crestUrl: true },
  });
  const byId = new Map(teams.map((t) => [t.id, t]));

  const entries: FavoriteEntry[] = ranked.map((r) => {
    const t = byId.get(r.teamId);
    return {
      ...r,
      nameNl: t?.nameNl ?? "?",
      fifaCode: t?.fifaCode ?? "?",
      crestUrl: t?.crestUrl ?? null,
    };
  });
  return { entries, totalPicks: picks.length };
}
