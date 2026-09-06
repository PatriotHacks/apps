import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import base from "@patriothacks/config/eslint/base.js";
import rls from "@patriothacks/config/eslint/no-admin-db-client.js";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...base,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The platform app renders for applicants. Every query must go through the
    // RLS wrapper, so the service-role client is a build failure here.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { rls },
    rules: { "rls/no-admin-db-client": "error" },
  },
  {
    ignores: [".next/**", ".open-next/**", ".wrangler/**", "cloudflare-env.d.ts"],
  },
];

export default config;
