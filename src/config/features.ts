// Feature flags. Flip a constant to enable a half-built feature once it's done.

/**
 * Prijzenpoule POLL (PollOption/PollVote). The tables exist but the vote UI and
 * the close→outcome logic are not built yet, so the poll is hidden in production
 * for now. The /beheer "Poll openen/sluiten" button + "Poll open" badge are
 * gated on this; /win has no poll UI yet.
 *
 * To enable later (before the knockout): set this to `true` and ship the vote UI
 * + outcome logic. No data migration needed — the tables are already in place.
 */
export const POLL_ENABLED = false;
