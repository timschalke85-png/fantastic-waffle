"use client";

import { useEffect, useState } from "react";

/** Live countdown to a kickoff (Dutch). Client-only so the clock ticks; the
 *  server passes an ISO string. Renders a stable placeholder until mounted to
 *  avoid hydration mismatch. */
export function NextMatchCountdown({ kickoffUtcIso }: { kickoffUtcIso: string }) {
  const target = new Date(kickoffUtcIso).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <span className="tabular">—</span>;

  const ms = target - now;
  if (ms <= 0) return <span className="font-semibold text-brand-accent">nu bezig</span>;

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = d > 0 ? [`${d}d`, `${h}u`, `${m}m`] : h > 0 ? [`${h}u`, `${m}m`, `${sec}s`] : [`${m}m`, `${sec}s`];

  return <span className="tabular font-semibold">{parts.join(" ")}</span>;
}
