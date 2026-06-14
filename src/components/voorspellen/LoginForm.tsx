"use client";

// Identity gate for /voorspellen, split into two deliberate actions so a mistyped
// bijnaam can never silently create a second account:
//  - Registreren -> registerAction (creates a NEW account; rejects a taken bijnaam)
//  - Inloggen    -> signInAction (signs in to an EXISTING account; never creates)
// The server (participant-auth) enforces both; this is just the form. After an
// error the originating tab re-opens (via the ?tab= param).
import { useState } from "react";
import { registerAction, signInAction } from "@/app/voorspellen/actions";

const ERRORS: Record<string, string> = {
  nickname: "Kies een bijnaam van 2 tot 24 tekens.",
  pin: "De pincode moet uit precies 4 cijfers bestaan.",
  wrong_pin: "De pincode klopt niet voor deze bijnaam. Probeer het opnieuw.",
  taken:
    "Die bijnaam is al in gebruik. Kies een andere bijnaam, of ga naar Inloggen als dit account van jou is.",
  unknown:
    "We kennen deze bijnaam niet. Controleer of je 'm precies goed hebt getypt — of maak een nieuw account aan via Registreren.",
  auth: "Je sessie is verlopen. Log opnieuw in om verder te gaan.",
};

const inputClass = "w-full rounded border border-brand-ink/20 px-3 py-2";

export function LoginForm({ error, tab }: { error?: string; tab?: string }) {
  const initialTab: "register" | "login" = tab === "login" ? "login" : "register";
  const [active, setActive] = useState<"register" | "login">(initialTab);
  const [showName, setShowName] = useState(false);

  // Only show the error on the tab that produced it; switching tabs clears it.
  const showError = !!error && !!ERRORS[error] && active === initialTab;

  return (
    <div className="rounded-xl border border-brand-ink/15 p-4">
      <div role="tablist" aria-label="Inloggen of registreren" className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-brand-ink/5 p-1">
        {([["register", "Registreren"], ["login", "Inloggen"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            onClick={() => setActive(key)}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              active === key ? "bg-white text-brand-ink shadow-sm" : "text-brand-ink/55 hover:text-brand-ink/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showError && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{ERRORS[error!]}</p>
      )}

      {active === "register" ? (
        <form action={registerAction}>
          <h2 className="text-sm font-semibold">Nieuw account aanmaken</h2>
          <p className="mt-1 text-[11px] text-brand-ink/55">
            Kies een bijnaam en pincode. Onthoud ze goed — daarmee log je later weer in om je voorspellingen
            te bewerken.
          </p>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium">Bijnaam</span>
            <input name="nickname" required maxLength={24} autoComplete="username" className={inputClass} />
          </label>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Pincode (4 cijfers)</span>
            <input
              name="pin"
              required
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="new-password"
              className="w-28 rounded border border-brand-ink/20 px-3 py-2 tabular tracking-[0.4em]"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowName((v) => !v)}
            className="mt-3 text-xs text-brand-ink/60 underline"
          >
            {showName ? "Verberg naam-opties" : "Optioneel: vul je naam in"}
          </button>

          {showName && (
            <div className="mt-2 space-y-2 rounded bg-brand-ink/5 p-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Volledige naam (optioneel)</span>
                <input name="fullName" maxLength={60} className={inputClass} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="showFullName" className="h-4 w-4" />
                <span>Toon mijn volledige naam op het klassement</span>
              </label>
            </div>
          )}

          <button type="submit" className="mt-4 w-full rounded-lg bg-brand-accent px-4 py-2.5 font-semibold text-white">
            Account aanmaken
          </button>
        </form>
      ) : (
        <form action={signInAction}>
          <h2 className="text-sm font-semibold">Inloggen</h2>
          <p className="mt-1 text-[11px] text-brand-ink/55">
            Vul de bijnaam en pincode in waarmee je je account hebt aangemaakt.
          </p>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium">Bijnaam</span>
            <input name="nickname" required maxLength={24} autoComplete="username" className={inputClass} />
          </label>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Pincode (4 cijfers)</span>
            <input
              name="pin"
              required
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="current-password"
              className="w-28 rounded border border-brand-ink/20 px-3 py-2 tabular tracking-[0.4em]"
            />
          </label>

          <button type="submit" className="mt-4 w-full rounded-lg bg-brand-accent px-4 py-2.5 font-semibold text-white">
            Inloggen
          </button>
        </form>
      )}

      <p className="mt-3 text-[11px] text-brand-ink/50">
        Alleen je bijnaam is zichtbaar voor anderen, tenzij je zelf je naam toont. Dit is een spel onder
        vrienden, geen kansspel.
      </p>
    </div>
  );
}
