// On-demand revalidation (CLAUDE.md "Live data strategy" — no cron on Hobby).
//
// FASEN Fase 2 calls this refreshScores(); it refreshes MATCH DATA (status +
// scores) from the provider, not leaderboard points (that's recomputeScores() in
// Fase 7). Named refreshMatchData() to avoid confusion.
//
// Strategy: on every public-page request, check settings.last_api_fetch_utc.
//  - if any match is live or inside a match window: refetch when cache > 60s old
//  - otherwise: refetch when cache > 15min old
// Every fetched result is upserted into `matches` (the DB is the render source).
// Rows with manually_overridden = true are NEVER touched by the API.

import { prisma } from "./db";
import { getAdapter } from "./adapters";
import { getSetting, setSetting } from "./settings";

export const STALE_LIVE_MS = 60 * 1000; // 60s during live windows
export const STALE_IDLE_MS = 15 * 60 * 1000; // 15min otherwise
const WINDOW_BEFORE_MS = 10 * 60 * 1000; // a match "window" opens 10min before kickoff
const WINDOW_AFTER_MS = 150 * 60 * 1000; // and closes 150min after (covers ET + penalties)

export interface RefreshResult {
  refreshed: boolean;
  reason: "fresh" | "stale" | "forced" | "error";
  inLiveWindow: boolean;
  fetchedCount: number; // matches returned by the provider this run (0 if skipped)
  updated: number; // rows updated from the API
  skippedOverridden: number; // rows left untouched because manually_overridden
  lastFetchUtc: string | null;
  error?: string;
}

export function isInLiveWindow(
  matches: { status: string; kickoffUtc: Date }[],
  nowMs: number,
): boolean {
  return matches.some((m) => {
    if (m.status === "LIVE") return true;
    const k = m.kickoffUtc.getTime();
    return nowMs >= k - WINDOW_BEFORE_MS && nowMs <= k + WINDOW_AFTER_MS;
  });
}

/**
 * Refetch match results from the provider when the cache is stale (or forced),
 * upserting status/scores into `matches` and skipping manually overridden rows.
 * Safe to call on every request; it self-throttles via last_api_fetch_utc.
 */
export async function refreshMatchData(opts: { force?: boolean } = {}): Promise<RefreshResult> {
  const nowMs = Date.now();
  const lastFetch = await getSetting("last_api_fetch_utc");

  const matches = await prisma.match.findMany({ select: { status: true, kickoffUtc: true } });
  const inLiveWindow = isInLiveWindow(matches, nowMs);
  const threshold = inLiveWindow ? STALE_LIVE_MS : STALE_IDLE_MS;

  const ageMs = lastFetch ? nowMs - new Date(lastFetch).getTime() : Infinity;
  if (!opts.force && ageMs < threshold) {
    return {
      refreshed: false,
      reason: "fresh",
      inLiveWindow,
      fetchedCount: 0,
      updated: 0,
      skippedOverridden: 0,
      lastFetchUtc: lastFetch,
    };
  }

  try {
    const snap = await getAdapter().getCompetitionSnapshot();

    // Resolve provider team ids -> our Team.id (for penalty winner + knockout fill-in).
    const teams = await prisma.team.findMany({ select: { id: true, apiTeamId: true } });
    const teamIdByApiId = new Map(teams.map((t) => [t.apiTeamId, t.id]));

    // Current state, to skip overridden rows and only fill knockout teams once.
    const existing = await prisma.match.findMany({
      select: { apiMatchId: true, manuallyOverridden: true, homeTeamId: true, awayTeamId: true },
    });
    const existingByApiId = new Map(existing.map((m) => [m.apiMatchId, m]));

    let updated = 0;
    let skippedOverridden = 0;

    for (const m of snap.matches) {
      const cur = existingByApiId.get(m.apiMatchId);
      if (!cur) continue; // unknown match (shouldn't happen post-seed)
      if (cur.manuallyOverridden) {
        skippedOverridden++;
        continue;
      }
      const data: Record<string, unknown> = {
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        wentToExtraTime: m.wentToExtraTime,
        penaltyWinnerTeamId:
          m.penaltyWinnerApiTeamId != null
            ? teamIdByApiId.get(m.penaltyWinnerApiTeamId) ?? null
            : null,
      };
      // Fill in knockout teams as they resolve, but never wipe a known team to null.
      if (cur.homeTeamId == null && m.homeApiTeamId != null) {
        data.homeTeamId = teamIdByApiId.get(m.homeApiTeamId) ?? null;
      }
      if (cur.awayTeamId == null && m.awayApiTeamId != null) {
        data.awayTeamId = teamIdByApiId.get(m.awayApiTeamId) ?? null;
      }
      await prisma.match.update({ where: { apiMatchId: m.apiMatchId }, data });
      updated++;
    }

    const fetchedAt = new Date(nowMs).toISOString();
    await setSetting("last_api_fetch_utc", fetchedAt);
    await setSetting("api_provider", snap.provider);

    return {
      refreshed: true,
      reason: opts.force ? "forced" : "stale",
      inLiveWindow,
      fetchedCount: snap.matches.length,
      updated,
      skippedOverridden,
      lastFetchUtc: fetchedAt,
    };
  } catch (e) {
    // Provider hiccup must not break the page; serve whatever the DB holds.
    return {
      refreshed: false,
      reason: "error",
      inLiveWindow,
      fetchedCount: 0,
      updated: 0,
      skippedOverridden: 0,
      lastFetchUtc: lastFetch,
      error: (e as Error).message,
    };
  }
}
