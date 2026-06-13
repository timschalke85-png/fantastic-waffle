"use client";

// Route-level error boundary (covers the public pages). Interface voice: say what
// happened and what to do, no apologies. Most failures here are a transient data
// fetch, so "opnieuw proberen" (reset) is the primary action.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border border-brand-ink/15 p-6">
        <p className="text-xs uppercase tracking-wide text-brand-accent">Hotel van Saaze</p>
        <h1 className="mt-1 text-xl font-bold">Deze pagina laadde niet</h1>
        <p className="mt-2 text-sm text-brand-ink/70">
          De gegevens konden even niet worden opgehaald. Dat is meestal tijdelijk — probeer het opnieuw.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={reset}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Opnieuw proberen
          </button>
          <a
            href="/"
            className="rounded-lg border border-brand-ink/20 px-4 py-2 text-sm font-semibold text-brand-ink/70"
          >
            Naar het overzicht
          </a>
        </div>
      </div>
    </main>
  );
}
