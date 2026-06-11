// Provider-agnostic shapes. The rest of the app depends ONLY on these, never on
// a provider's raw JSON, so the provider can be swapped (football-data.org ->
// API-Football) by changing one factory. See CLAUDE.md "Live data strategy".

export type ProviderStage =
  | "GROUP"
  | "R32"
  | "R16"
  | "QF"
  | "SF"
  | "THIRD_PLACE"
  | "FINAL";

export type ProviderStatus = "SCHEDULED" | "LIVE" | "FINISHED";

export interface ProviderTeam {
  apiTeamId: number;
  nameEn: string; // provider's English name; matched to name_nl in seed
  shortName: string | null;
  fifaCode: string; // 3-letter code (provider "tla"), e.g. NED, JPN
  crestUrl: string | null;
  groupLetter: string | null; // A–L, derived from group-stage matches
}

export interface ProviderMatch {
  apiMatchId: number;
  stage: ProviderStage;
  groupLetter: string | null; // group stage only
  kickoffUtc: string; // ISO-8601, always UTC (Z)
  venue: string | null; // null when the provider has no real venue
  status: ProviderStatus;
  homeApiTeamId: number | null; // null for unresolved knockout placeholders
  awayApiTeamId: number | null;
  homeScore: number | null; // full-time incl. extra time
  awayScore: number | null;
  wentToExtraTime: boolean;
  penaltyWinnerApiTeamId: number | null; // set only when decided on penalties
}

export interface CompetitionSnapshot {
  provider: string;
  fetchedAtUtc: string; // ISO-8601 UTC
  teams: ProviderTeam[];
  matches: ProviderMatch[];
}

/**
 * The single fetcher contract. Implementations live alongside this file.
 * `getCompetitionSnapshot` returns the full normalized WC2026 dataset; callers
 * (seed + the on-demand revalidator in Fase 2) upsert it into Postgres.
 */
export interface FootballDataAdapter {
  readonly providerName: string;
  getCompetitionSnapshot(): Promise<CompetitionSnapshot>;
}
