"use client";

// Identity gate for /voorspellen. First save creates the participant; an existing
// bijnaam requires the PIN. fullName + "toon mijn naam" are optional and only used
// when the account is first created. Server validates everything (loginAction).
import { useState } from "react";
import { loginAction } from "@/app/voorspellen/actions";

const ERRORS: Record<string, string> = {
  nickname: "Kies een bijnaam van 2 tot 24 tekens.",
  pin: "De pincode moet uit precies 4 cijfers bestaan.",
  wrong_pin: "Onjuiste pincode voor deze bijnaam.",
  taken: "Die bijnaam is net geclaimd. Kies een andere of probeer opnieuw.",
  auth: "Log opnieuw in.",
};

export function LoginForm({ error }: { error?: string }) {
  const [showFirstTime, setShowFirstTime] = useState(false);

  return (
    <form action={loginAction} className="rounded-xl border border-brand-ink/15 p-4">
      <h2 className="text-sm font-semibold">Inloggen of account aanmaken</h2>
      <p className="mt-1 text-[11px] text-brand-ink/55">
        Nieuw? Kies een bijnaam en pincode — die maken meteen je account aan. Al meegedaan? Vul dezelfde
        bijnaam en pincode in om je voorspellingen te bewerken.
      </p>

      {error && ERRORS[error] && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{ERRORS[error]}</p>
      )}

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium">Bijnaam</span>
        <input
          name="nickname"
          required
          maxLength={24}
          autoComplete="username"
          className="w-full rounded border border-brand-ink/20 px-3 py-2"
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium">Pincode (4 cijfers)</span>
        <input
          name="pin"
          required
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          autoComplete="off"
          className="w-28 rounded border border-brand-ink/20 px-3 py-2 tabular tracking-[0.4em]"
        />
      </label>

      <button
        type="button"
        onClick={() => setShowFirstTime((v) => !v)}
        className="mt-3 text-xs text-brand-ink/60 underline"
      >
        {showFirstTime ? "Verberg" : "Eerste keer? Vul optioneel je naam in"}
      </button>

      {showFirstTime && (
        <div className="mt-2 space-y-2 rounded bg-brand-ink/5 p-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Volledige naam (optioneel)</span>
            <input name="fullName" maxLength={60} className="w-full rounded border border-brand-ink/20 px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showFullName" className="h-4 w-4" />
            <span>Toon mijn volledige naam op het klassement</span>
          </label>
        </div>
      )}

      <button
        type="submit"
        className="mt-4 w-full rounded-lg bg-brand-accent px-4 py-2.5 font-semibold text-white"
      >
        Doorgaan
      </button>

      <p className="mt-3 text-[11px] text-brand-ink/50">
        Alleen je bijnaam is zichtbaar voor anderen, tenzij je zelf je naam toont. Dit is een spel onder
        vrienden, geen kansspel.
      </p>
    </form>
  );
}
