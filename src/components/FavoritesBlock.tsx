// "Favorieten van de poule" — the left block in the two-block row (next to the
// NL countdown). Veld-green colour block of equal weight. Aggregated counts only
// (no names); honest subtitle that it reflects predictions, not a result.
import type { FavoritesData } from "@/lib/favorites";
import { TeamCrest } from "@/components/TeamCrest";

export function FavoritesBlock({ data }: { data: FavoritesData }) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-wk-field px-5 py-4 text-white shadow-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">Favorieten van de poule</p>
        <p className="text-[10px] text-white/65">op basis van wat deelnemers voorspelden</p>
      </div>

      {data.entries.length === 0 ? (
        <p className="mt-3 flex-1 text-sm text-white/85">Nog geen voorspellingen.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {data.entries.map((f) => (
            <li key={f.teamId} className="flex items-center gap-2">
              <TeamCrest src={f.crestUrl} code={f.fifaCode} />
              <span className="flex-1 truncate text-sm font-bold">{f.nameNl}</span>
              <span className="text-lg font-extrabold tabular">{f.pct}%</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
