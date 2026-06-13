// Route-level loading skeleton (covers all public pages while server data loads).
// Calm, low-motion; the pulse is dropped under prefers-reduced-motion.
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6" aria-busy="true" aria-label="Bezig met laden">
      <div className="animate-pulse motion-reduce:animate-none">
        <div className="mb-5 space-y-2">
          <div className="h-3 w-28 rounded bg-brand-ink/10" />
          <div className="h-7 w-56 rounded bg-brand-ink/10" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-brand-ink/5" />
          ))}
        </div>
      </div>
    </main>
  );
}
