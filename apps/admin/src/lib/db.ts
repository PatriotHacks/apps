import {
  createDrizzleSupabaseClient,
  type DatabaseTransaction,
  type DrizzleSupabaseClient,
} from "@patriothacks/database";

import { requireClaims, requireStaff } from "@/lib/auth";

/**
 * A connection carrying the caller's JWT, for work that spans more than one
 * transaction. The caller owns it and must call `end()`.
 *
 * The streamed CSV export is why this exists: it pulls a batch per `pull` of
 * the response stream, which is many transactions over a period the request
 * handler has already returned from.
 */
export async function staffClient(): Promise<DrizzleSupabaseClient> {
  await requireStaff();
  return createDrizzleSupabaseClient(await requireClaims());
}

/**
 * Every console read runs through here. The caller's JWT is carried into the
 * transaction, so the `*_select_staff` policies are what answer and
 * `requireStaff()` stays the single service-role site in the app.
 */
export async function queryAsStaff<T>(run: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
  const db = await staffClient();
  try {
    return await db.rls(run);
  } finally {
    await db.end();
  }
}
