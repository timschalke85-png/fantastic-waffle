"use client";

// Day-game prediction for one broadcast match: goals per team per half (4 numbers).
// Prefilled from the saved prediction; read-only once the match has kicked off.
import { useState } from "react";
import { saveDailyPredictionAction, type DailyPredictionInput } from "@/app/win/actions";
import { TeamCrest } from "@/components/TeamCrest";
import type { DailyPredictionValues, WinDagspel } from "@/lib/prijzenpoule-data";

const ERRORS: Record<string, string> = {
  auth: "Log opnieuw in.",
  not_found: "Deze wedstrijd is niet meer beschikbaar.",
  not_checked_in: "Check eerst in voor vanavond.",
  locked: "De wedstrijd is begonnen — voorspellen kan niet meer.",
  invalid: "Vul alle vier de getallen in (0 of hoger).",
};

const numeric = (s: string) => s.replace(/[^0-9]/g, "").slice(0, 2);
type Status = "idle" | "saving" | "saved" | "error";

export function DailyPredictionForm({
  dagspel,
  existing,
  locked,
}: {
  dagspel: WinDagspel;
  existing?: DailyPredictionValues;
  locked: boolean;
}) {
  const [fhh, setFhh] = useState(existing ? String(existing.firstHalfHome) : "");
  const [fha, setFha] = useState(existing ? String(existing.firstHalfAway) : "");
  const [shh, setShh] = useState(existing ? String(existing.secondHalfHome) : "");
  const [sha, setSha] = useState(existing ? String(existing.secondHalfAway) : "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    setError(null);
    const input: DailyPredictionInput = {
      eveningMatchId: dagspel.eveningMatchId,
      firstHalfHome: fhh,
      firstHalfAway: fha,
      secondHalfHome: shh,
      secondHalfAway: sha,
    };
    const res = await saveDailyPredictionAction(input);
    if (res.ok) setStatus("saved");
    else {
      setStatus("error");
      setError(ERRORS[res.error] ?? "Er ging iets mis.");
    }
  }

  const Teams = (
    <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold">
      <span className="flex items-center gap-1.5">
        <TeamCrest src={dagspel.homeCrest} code={dagspel.homeCode} />
        {dagspel.homeName}
      </span>
      <span className="text-brand-ink/40">–</span>
      <span className="flex items-center gap-1.5">
        {dagspel.awayName}
        <TeamCrest src={dagspel.awayCrest} code={dagspel.awayCode} />
      </span>
    </div>
  );

  if (locked) {
    const shown = existing
      ? `${existing.firstHalfHome}–${existing.firstHalfAway}  ·  ${existing.secondHalfHome}–${existing.secondHalfAway}`
      : null;
    return (
      <li className="rounded-xl border border-brand-ink/20 bg-brand-ink/[0.03] p-3">
        {Teams}
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-brand-ink/45">
          Begonnen — vergrendeld
        </p>
        <p className="mt-1 text-center text-sm">
          {shown ? (
            <>
              Jouw voorspelling: <strong className="tabular">{shown}</strong>{" "}
              <span className="text-[11px] text-brand-ink/45">(1e helft · 2e helft)</span>
            </>
          ) : (
            <span className="text-brand-ink/50">Je hebt geen voorspelling ingevuld.</span>
          )}
        </p>
      </li>
    );
  }

  const Row = (
    label: string,
    h: string,
    setH: (v: string) => void,
    a: string,
    setA: (v: string) => void,
  ) => (
    <div className="flex items-center justify-center gap-2 text-sm">
      <span className="w-16 text-right text-[11px] font-semibold uppercase tracking-wide text-brand-ink/50">
        {label}
      </span>
      <input
        aria-label={`${dagspel.homeName} ${label}`}
        inputMode="numeric"
        pattern="[0-9]*"
        value={h}
        onChange={(e) => setH(numeric(e.target.value))}
        className="h-10 w-10 rounded-md border border-brand-ink/20 text-center text-lg font-extrabold tabular"
      />
      <span className="text-brand-ink/30">–</span>
      <input
        aria-label={`${dagspel.awayName} ${label}`}
        inputMode="numeric"
        pattern="[0-9]*"
        value={a}
        onChange={(e) => setA(numeric(e.target.value))}
        className="h-10 w-10 rounded-md border border-brand-ink/20 text-center text-lg font-extrabold tabular"
      />
    </div>
  );

  return (
    <li className="rounded-xl border border-brand-ink/15 bg-white p-3 shadow-sm">
      {Teams}
      <div className="space-y-1.5">
        {Row("1e helft", fhh, setFhh, fha, setFha)}
        {Row("2e helft", shh, setShh, sha, setSha)}
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          onClick={save}
          disabled={status === "saving"}
          className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "saving" ? "Opslaan…" : "Opslaan"}
        </button>
        {status === "saved" && <span className="text-[12px] font-medium text-green-700">Opgeslagen</span>}
        {status === "error" && <span className="text-[12px] text-red-600">{error}</span>}
      </div>
    </li>
  );
}
