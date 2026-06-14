// TEMPORARY teaser for the upcoming prize system. This is meant to be removed once
// the real prize feature ships: delete this file + its import and <PrizeTeaser />
// usage in src/app/page.tsx. The copy lives in TEASER below for quick edits.
//
// IMPORTANT: keep it vague — no concrete prizes or amounts are promised yet
// ("leuke prijzen", "binnenkort meer"), only that something is coming.
const TEASER = {
  eyebrow: "Binnenkort bij Van Saaze",
  title: "Er komt een verrassing aan",
  body: "Straks kun je met de poule leuke prijzen winnen. Hou deze pagina in de gaten — binnenkort meer!",
};

export function PrizeTeaser() {
  return (
    <section
      className="mb-6 flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-copper to-wk-orange px-5 py-4 text-white shadow-sm"
      aria-label="Aankondiging: prijzen"
    >
      <span className="shrink-0 text-3xl" aria-hidden>
        🎁
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{TEASER.eyebrow}</p>
        <p className="text-lg font-extrabold leading-tight">{TEASER.title}</p>
        <p className="mt-0.5 text-sm text-white/90">{TEASER.body}</p>
      </div>
    </section>
  );
}
