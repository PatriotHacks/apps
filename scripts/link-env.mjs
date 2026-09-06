// Next.js does not read .env from a monorepo root, so each app links to it.
import { symlinkSync, existsSync, lstatSync, unlinkSync } from "fs";

for (const app of ["platform", "admin"]) {
  const link = new URL(`../apps/${app}/.env`, import.meta.url);
  if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) unlinkSync(link);
  symlinkSync("../../.env", link, "file");
}
