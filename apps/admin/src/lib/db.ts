import { createDrizzleSupabaseClient, type DatabaseTransaction } from "@patriothacks/database";

import { requireClaims, requireStaff } from "@/lib/auth";

/**
 * Every console read runs through here. The caller's JWT is carried into the
 * transaction, so the `*_select_staff` policies are what answer and
 * `requireStaff()` stays the single service-role site in the app.
 */
export async function queryAsStaff<T>(run: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
  await requireStaff();
  const claims = await requireClaims();

  const db = createDrizzleSupabaseClient(claims);
  try {
    return await db.rls(run);
  } finally {
    await db.end();
  }
}
