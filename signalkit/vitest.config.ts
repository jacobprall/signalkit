import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Type-check tests as part of `vitest run` so payload type drift is
    // caught (e.g. JobPayload field renames). This was previously
    // disabled, which let test files compile against an outdated shape.
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.json",
      include: ["**/*.test.ts", "**/*.test.tsx"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
