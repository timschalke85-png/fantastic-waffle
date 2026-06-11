import type { Config } from "tailwindcss";

/**
 * Brand tokens are driven by CSS variables (see src/app/globals.css) so the
 * Van Saaze palette can be swapped in once /branding/brand.md lands without
 * touching component code. Until then they resolve to neutral placeholders
 * plus the oranje WK accent, per CLAUDE.md branding rules.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--brand-primary)",
          accent: "var(--brand-accent)",
          surface: "var(--brand-surface)",
          ink: "var(--brand-ink)",
        },
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
    },
  },
  plugins: [],
};

export default config;
