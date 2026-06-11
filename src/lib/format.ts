// Display helpers. Rule: store UTC, display Europe/Amsterdam (CLAUDE.md).

const AMS = "Europe/Amsterdam";

/** e.g. "zo 14 jun 22:00" — Dutch, Amsterdam time. */
export function fmtDateTimeAms(d: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: AMS,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** e.g. "22:00" — Amsterdam time only. */
export function fmtTimeAms(d: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: AMS,
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** "x sec/min/uur geleden" for the "laatst bijgewerkt" label. */
export function fmtRelativeNl(d: Date | string | null): string {
  if (!d) return "nog niet";
  const ms = Date.now() - (typeof d === "string" ? new Date(d) : d).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} sec geleden`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min geleden`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} uur geleden`;
  return fmtDateTimeAms(d);
}
