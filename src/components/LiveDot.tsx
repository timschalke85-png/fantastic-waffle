// Live indicator for the header. Pulses (WK-oranje) only when a Poule F match is
// actually LIVE; otherwise a dim grey dot, no pulse. The pulse animation is
// disabled automatically under prefers-reduced-motion (see globals.css).
export function LiveDot({ live }: { live: boolean }) {
  if (live) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white">
        <span className="live-pulse inline-block h-2 w-2 rounded-full bg-wk-orange" aria-hidden />
        LIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45" aria-label="geen wedstrijd live">
      <span className="inline-block h-2 w-2 rounded-full bg-white/30" aria-hidden />
    </span>
  );
}
