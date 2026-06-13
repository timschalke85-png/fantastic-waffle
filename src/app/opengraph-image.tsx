// OG share image for WhatsApp/social link previews. Generated with next/og so it
// stays in-repo (no binary asset) and on-brand. Static content only — no
// tournament data is invented here. Next auto-wires og:image + twitter:image
// from this file (absolute URL via metadataBase in layout.tsx).
import { ImageResponse } from "next/og";

export const alt = "WK 2026 Poule — Hotel van Saaze";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f172a",
          color: "#ffffff",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* left accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 20,
            background: "#d85a30",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#d85a30",
          }}
        >
          Hotel van Saaze
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 124, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
            WK 2026 Poule
          </div>
          <div style={{ display: "flex", marginTop: 18, width: 220, height: 12, background: "#0f6e56" }} />
          <div style={{ display: "flex", marginTop: 30, fontSize: 42, color: "#cbd5e1" }}>
            Voorspel het hele toernooi mee — van de poules tot de finale.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#94a3b8" }}>
          Een spel onder vrienden, geen kansspel.
        </div>
      </div>
    ),
    { ...size },
  );
}
