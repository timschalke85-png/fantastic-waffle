// Factory: pick the provider from DATA_PROVIDER. Everything else imports
// `getAdapter()` and depends only on the FootballDataAdapter interface.

import { ApiFootballAdapter } from "./api-football";
import { FootballDataOrgAdapter } from "./football-data";
import type { FootballDataAdapter } from "./types";

export type { FootballDataAdapter, CompetitionSnapshot, ProviderTeam, ProviderMatch } from "./types";

export function getAdapter(
  provider = process.env.DATA_PROVIDER ?? "football-data",
): FootballDataAdapter {
  switch (provider) {
    case "football-data":
      return new FootballDataOrgAdapter();
    case "api-football":
      return new ApiFootballAdapter();
    default:
      throw new Error(`Unknown DATA_PROVIDER "${provider}".`);
  }
}
