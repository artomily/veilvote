import { defineConfig } from "vitest/config";

// Contract tests run in Node against the compiled circuits in `managed/`.
// Scoped to `tests/` so Vitest never picks up the Next.js app files.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
