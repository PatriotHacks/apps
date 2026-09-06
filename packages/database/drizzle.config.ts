import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  // Mandatory. drizzle-kit 1.0 manages every schema by default; without this
  // it generates destructive migrations against Supabase's auth, storage,
  // realtime and vault schemas.
  schemaFilter: ["public"],
  dbCredentials: {
    // Direct/session connection on 5432 — DDL is not safe over the
    // transaction-mode pooler the apps use at runtime.
    url: process.env.DIRECT_DATABASE_URL!,
  },
});
