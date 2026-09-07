// Rebuilds the LOCAL Supabase database only.
//
// The obvious version of this script — `supabase db reset && pnpm db:migrate && pnpm db:seed` —
// resets the local database and then migrates and seeds whatever DIRECT_DATABASE_URL points at,
// which for anyone with a hosted project configured is production. So the connection string is
// read back from the running stack instead of from the environment.
import { execFileSync } from "node:child_process";

const run = (args, env) =>
  execFileSync("pnpm", args, { stdio: "inherit", env: { ...process.env, ...env } });

run(["supabase", "db", "reset", "--no-seed"]);

const raw = execFileSync("pnpm", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
const { DB_URL: url } = JSON.parse(raw.slice(raw.indexOf("{")));

if (!/127\.0\.0\.1|localhost/.test(url ?? "")) {
  throw new Error(`refusing to migrate: local stack reported a non-local database (${url})`);
}

run(["db:migrate"], { DATABASE_URL: url, DIRECT_DATABASE_URL: url });
run(["db:seed"], { DATABASE_URL: url, DIRECT_DATABASE_URL: url });

console.log(`\nLocal database rebuilt at ${url}`);
