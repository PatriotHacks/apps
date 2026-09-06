import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Renderer suites opt into jsdom with a per-file `@vitest-environment`
    // docblock; everything else stays on the default node environment.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
