"use client";

// Team crest on a clean white chip. Loads the provider crest (crestUrl); if it's
// missing OR fails to load over the network, it falls back to a tidy fifaCode
// badge instead of a broken image — so a flaky external URL never looks messy.
import { useState } from "react";

export function TeamCrest({ src, code }: { src: string | null; code: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-brand-ink/5">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="h-6 w-6 object-contain" />
      ) : (
        <span className="text-[10px] font-extrabold text-brand-ink">{code}</span>
      )}
    </span>
  );
}
