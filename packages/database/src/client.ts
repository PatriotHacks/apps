import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema/index.ts";

export type SupabaseToken = {
  iss?: string;
  sub?: string;
  aud?: string[] | string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  role?: string;
};

export type Database = NodePgDatabase<typeof schema>;

export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type DrizzleSupabaseClient = {
  /**
   * Service-role connection. Bypasses RLS. Only ever used in admin console
   * paths, and only after an explicit `admins` role check.
   */
  admin: Database;
  /**
   * Runs the callback inside a transaction that carries the caller's JWT and
   * session role, so every policy applies. Everything user-scoped goes through
   * here.
   */
  rls: <T>(transaction: (tx: DatabaseTransaction) => Promise<T>) => Promise<T>;
  /** Releases the pooled connection. Call from the request's cleanup path. */
  end: () => Promise<void>;
};

/** `set local role` takes an identifier, not a parameter, so it cannot be bound. */
const SESSION_ROLES = new Set(["anon", "authenticated", "service_role"]);

const quote = (value: string) => value.replaceAll("'", "''");

/**
 * Constructed per request, never at module scope: on Cloudflare Workers a
 * connection opened while the module evaluates belongs to a different
 * invocation's I/O context and throws the moment it is used.
 */
export function createDrizzleSupabaseClient(token: SupabaseToken = {}): DrizzleSupabaseClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const role = token.role ?? "anon";
  if (!SESSION_ROLES.has(role)) {
    throw new Error(`Unsupported session role: ${role}`);
  }

  // max 1 because Supavisor is already the pool; a per-request pool of pools
  // just holds backends open for longer than the invocation.
  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  return {
    admin: db,
    rls: (transaction) =>
      db.transaction(async (tx) => {
        try {
          await tx.execute(sql`
            select set_config('request.jwt.claims', '${sql.raw(quote(JSON.stringify(token)))}', TRUE);
            select set_config('request.jwt.claim.sub', '${sql.raw(quote(token.sub ?? ""))}', TRUE);
            set local role ${sql.raw(role)};
          `);
          return await transaction(tx);
        } finally {
          // Both COMMIT and ROLLBACK already revert transaction-local settings,
          // so this is belt and braces. If the callback threw, the transaction
          // is aborted and every further statement errors -- discard that so the
          // caller sees the original failure rather than "current transaction is
          // aborted".
          await tx
            .execute(
              sql`
            select set_config('request.jwt.claims', NULL, TRUE);
            select set_config('request.jwt.claim.sub', NULL, TRUE);
            reset role;
          `,
            )
            .catch(() => undefined);
        }
      }),
    end: () => pool.end(),
  };
}
