"use client";

// Check-in: enter the shared daily code that's on a sign/card in the restaurant.
// On success the page re-renders (router.refresh) into the day-game forms.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkInAction } from "@/app/win/actions";

const ERRORS: Record<string, string> = {
  auth: "Log opnieuw in om in te checken.",
  no_evening: "Er is op dit moment geen avond actief om in te checken.",
  no_code: "De code voor vanavond is nog niet ingesteld — vraag het even bij de bar.",
  wrong_code: "Die code klopt niet. Kijk op het bord of kaartje in het restaurant.",
  db: "Inchecken mislukt — de database was even niet bereikbaar, probeer opnieuw.",
};

export function CheckInForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("code", code);
    const res = await checkInAction(fd);
    if (res.ok) {
      router.refresh(); // now checked in -> dagspel-formulieren verschijnen
    } else {
      setBusy(false);
      setError(ERRORS[res.error] ?? "Er ging iets mis. Probeer het opnieuw.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-brand-ink/15 bg-white p-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Code van vanavond</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={24}
          autoComplete="off"
          placeholder="bijv. SAAZE7"
          className="w-full rounded border border-brand-ink/20 px-3 py-2 tracking-widest"
        />
      </label>
      {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-brand-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Bezig…" : "Inchecken"}
      </button>
    </form>
  );
}
