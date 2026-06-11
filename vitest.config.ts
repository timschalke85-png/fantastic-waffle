import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the "@/..." path alias (tsconfig paths) so tests can import modules
// that use it (e.g. the server actions). Pure-logic tests keep using relative
// imports; this is additive and does not change existing behavior.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
