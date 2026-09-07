import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * The suite sees the same `.env` the app does — the broadcast tests talk to the
 * configured database rather than a fixture, and pointing them somewhere else
 * would prove nothing. Read here rather than through a dotenv dependency: the
 * file is a handful of `KEY="value"` lines and Next loads it for the app itself.
 */
function dotenv(): Record<string, string> {
  try {
    const contents = readFileSync(new URL("./.env", import.meta.url), "utf8");

    return Object.fromEntries(
      contents
        .split("\n")
        .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
        .filter((match): match is RegExpExecArray => match !== null)
        .map(([, key, value]) => [key!, value!.replace(/^"(.*)"$/, "$1")]),
    );
  } catch {
    return {};
  }
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    env: dotenv(),
    // The broadcast suite seeds 520 people and walks the whole send.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
