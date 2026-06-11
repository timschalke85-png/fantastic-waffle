// API-Football (api-sports.io) fallback provider.
//
// Phase 1 verified that football-data.org DOES return WC2026 on the free tier,
// so this fallback is intentionally a stub: the interface is the contract, and
// wiring this up is a localized change (mapping api-sports' fixtures/teams
// response into ProviderTeam/ProviderMatch) only if the primary provider ever
// stops serving WC2026. Keeping the seam explicit honors CLAUDE.md's
// "abstract the fetcher behind one adapter interface so the provider can be
// swapped" requirement.

import type { CompetitionSnapshot, FootballDataAdapter } from "./types";

export class ApiFootballAdapter implements FootballDataAdapter {
  readonly providerName = "api-football";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_apiKey = process.env.API_FOOTBALL_KEY) {}

  async getCompetitionSnapshot(): Promise<CompetitionSnapshot> {
    throw new Error(
      "ApiFootballAdapter is not implemented. football-data.org was verified " +
        "to serve WC2026 in Fase 1, so the fallback was never needed. Implement " +
        "the api-sports.io mapping here if the primary provider drops WC2026.",
    );
  }
}
