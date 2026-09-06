import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/**
 * Shared flat config. Apps layer `next/core-web-vitals` on top of this;
 * library packages use it as-is.
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.open-next/**",
      "**/.turbo/**",
      "**/.wrangler/**",
      "**/drizzle/**",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  prettier,
];
