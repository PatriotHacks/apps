import {
  createDrizzleSupabaseClient,
  type DatabaseTransaction,
  type SupabaseToken,
} from "@patriothacks/database";

/**
 * The only database entry point in this app. The service-role client is never
 * re-exported, and `rls/no-admin-db-client` fails the build if anything under
 * src/ reaches for it anyway — forgetting the wrapper does not throw, it just
 * silently returns every applicant's rows.
 */
export async function withRls<T>(
  token: SupabaseToken,
  query: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  const db = createDrizzleSupabaseClient(token);
  try {
    return await db.rls(query);
  } finally {
    await db.end();
  }
}
