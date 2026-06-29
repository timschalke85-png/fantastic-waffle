// Europe/Amsterdam <-> UTC conversion for the admin datetime-local inputs.
//
// A <input type="datetime-local"> carries NO timezone: the admin types a local
// wall-clock time. The whole app stores instants as UTC ISO, so we convert here.
// DST-correct: the Amsterdam offset depends on the instant (CET +1 / CEST +2), so
// we resolve it from the actual zone offset via Intl rather than a fixed offset.
// Pure (no I/O) — unit-tested in tests/datetime.test.ts.

const TZ = "Europe/Amsterdam";

/** The zone's offset from UTC, in ms, at the given UTC instant. */
function zoneOffsetMs(utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - utcMs;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Convert an Amsterdam wall-clock value ("YYYY-MM-DDTHH:mm", the datetime-local
 * format) to a UTC ISO string. Returns null on a malformed value. DST edges are
 * settled by refining the offset against the resolved instant.
 */
export function amsterdamLocalToUtcIso(local: string): string | null {
  const m = LOCAL_RE.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  if (Number.isNaN(wall)) return null;
  // t satisfies t + offset(t) = wall; iterate twice to settle DST transitions.
  let utc = wall - zoneOffsetMs(wall);
  utc = wall - zoneOffsetMs(utc);
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Render a stored UTC ISO instant back into the datetime-local field value in
 * Amsterdam wall-clock time ("YYYY-MM-DDTHH:mm"). Empty string on a bad input.
 */
export function utcIsoToAmsterdamLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
