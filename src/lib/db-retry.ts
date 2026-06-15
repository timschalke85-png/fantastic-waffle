// One-shot retry for a transient DB connection drop — chiefly the Neon dev child
// going to sleep (scale-to-zero) and terminating the pooled connection
// (PostgreSQL 57P01). Only the first query after wake hits the stale connection,
// so a single retry after a short delay is enough. Deliberately small: no
// backoff, no circuit-breaker, no global middleware — wrap the critical writes.

const TRANSIENT_CODES = new Set(["57P01", "P1001", "P1017"]);
const TRANSIENT_MESSAGE_MARKERS = [
  "57P01",
  "terminating connection due to administrator command",
  "Can't reach database server",
  "Server has closed the connection",
];

/** True for a transient connection error (Neon scale-to-zero, dropped socket). */
export function isTransientConnectionError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  if (typeof code === "string" && TRANSIENT_CODES.has(code)) return true;
  const msg = (e as { message?: unknown }).message;
  return typeof msg === "string" && TRANSIENT_MESSAGE_MARKERS.some((m) => msg.includes(m));
}

/**
 * Run `fn`; on a transient connection error, wait `delayMs` and retry ONCE. Any
 * non-transient error — or a second transient failure — propagates unchanged.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, delayMs = 150): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isTransientConnectionError(e)) throw e;
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return fn(); // single retry; a second failure propagates
  }
}
