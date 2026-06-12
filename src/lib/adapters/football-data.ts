// football-data.org v4 provider. VERIFIED in Fase 1 to return the full WC2026
// dataset (104 matches) on the free tier. Free tier allows 10 req/min; the
// on-demand revalidation strategy (CLAUDE.md) stays well under that.

import type {
  CompetitionSnapshot,
  FootballDataAdapter,
  ProviderMatch,
  ProviderStage,
  ProviderStatus,
  ProviderTeam,
} from "./types";

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup

// football-data stage codes -> our ProviderStage.
const STAGE_MAP: Record<string, ProviderStage> = {
  GROUP_STAGE: "GROUP",
  LAST_32: "R32",
  LAST_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
  THIRD_PLACE: "THIRD_PLACE",
  FINAL: "FINAL",
};

function mapStatus(s: string): ProviderStatus {
  switch (s) {
    case "IN_PLAY":
    case "PAUSED":
      return "LIVE";
    case "FINISHED":
    case "AWARDED":
      return "FINISHED";
    // SCHEDULED, TIMED, SUSPENDED, POSTPONED, CANCELLED -> not yet a final result
    default:
      return "SCHEDULED";
  }
}

// "GROUP_F" -> "F"; anything else -> null.
function groupLetter(group: string | null): string | null {
  if (!group) return null;
  const m = /^GROUP_([A-L])$/.exec(group);
  return m ? m[1] : null;
}

interface RawTeam {
  id: number | null;
  name: string | null;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

interface RawMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  venue?: string | null;
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

export class FootballDataOrgAdapter implements FootballDataAdapter {
  readonly providerName = "football-data";
  private readonly apiKey: string;

  constructor(apiKey = process.env.FOOTBALL_DATA_API_KEY) {
    if (!apiKey) {
      throw new Error(
        "FOOTBALL_DATA_API_KEY is not set; cannot use the football-data provider.",
      );
    }
    this.apiKey = apiKey;
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "X-Auth-Token": this.apiKey },
      // Always go to the network; the DB is the render cache, not HTTP.
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `football-data ${path} -> HTTP ${res.status}: ${body.slice(0, 300)}`,
      );
    }
    return (await res.json()) as T;
  }

  async getCompetitionSnapshot(): Promise<CompetitionSnapshot> {
    const data = await this.fetchJson<{ matches: RawMatch[] }>(
      `/competitions/${COMPETITION}/matches`,
    );
    const raw = data.matches ?? [];

    const matches: ProviderMatch[] = raw.map((m) => {
      const stage = STAGE_MAP[m.stage];
      if (!stage) {
        throw new Error(`Unknown football-data stage "${m.stage}" (match ${m.id})`);
      }
      const wentToExtraTime = m.score.duration !== "REGULAR";
      let penaltyWinnerApiTeamId: number | null = null;
      if (m.score.duration === "PENALTY_SHOOTOUT") {
        if (m.score.winner === "HOME_TEAM") penaltyWinnerApiTeamId = m.homeTeam.id;
        else if (m.score.winner === "AWAY_TEAM") penaltyWinnerApiTeamId = m.awayTeam.id;
      }
      return {
        apiMatchId: m.id,
        stage,
        groupLetter: groupLetter(m.group),
        kickoffUtc: m.utcDate,
        // football-data returns a placeholder area ("World"/INT), not a real
        // stadium. Treat anything non-string as unknown rather than inventing.
        venue: typeof m.venue === "string" && m.venue.trim() ? m.venue : null,
        status: mapStatus(m.status),
        homeApiTeamId: m.homeTeam?.id ?? null,
        awayApiTeamId: m.awayTeam?.id ?? null,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        halfTimeHome: m.score.halfTime?.home ?? null,
        halfTimeAway: m.score.halfTime?.away ?? null,
        paused: m.status === "PAUSED",
        wentToExtraTime,
        penaltyWinnerApiTeamId,
      };
    });

    // Teams are only fully described inside group-stage matches (knockout slots
    // carry null teams until resolved). Collect the 48 from there.
    const teamMap = new Map<number, ProviderTeam>();
    for (const m of raw) {
      if (STAGE_MAP[m.stage] !== "GROUP") continue;
      const g = groupLetter(m.group);
      for (const t of [m.homeTeam, m.awayTeam]) {
        if (t?.id == null) continue;
        if (!teamMap.has(t.id)) {
          teamMap.set(t.id, {
            apiTeamId: t.id,
            nameEn: t.name ?? `Team ${t.id}`,
            shortName: t.shortName ?? null,
            fifaCode: t.tla ?? "",
            crestUrl: t.crest ?? null,
            groupLetter: g,
          });
        }
      }
    }

    return {
      provider: this.providerName,
      // Stamped by the caller layer; argless Date is fine in a normal runtime
      // (this file never runs inside the deterministic workflow sandbox).
      fetchedAtUtc: new Date().toISOString(),
      teams: [...teamMap.values()].sort((a, b) =>
        (a.groupLetter ?? "").localeCompare(b.groupLetter ?? "") ||
        a.nameEn.localeCompare(b.nameEn),
      ),
      matches: matches.sort(
        (a, b) => +new Date(a.kickoffUtc) - +new Date(b.kickoffUtc),
      ),
    };
  }
}
