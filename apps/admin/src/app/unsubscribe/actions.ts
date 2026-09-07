"use server";

import {
  createDrizzleSupabaseClient,
  emailUnsubscribes,
  profiles,
} from "@patriothacks/database";
import { eq } from "drizzle-orm";

import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export type UnsubscribeLookup =
  | { status: "ok"; email: string; alreadyUnsubscribed: boolean }
  | { status: "invalid" };

export type UnsubscribeResult = { status: "unsubscribed" } | { status: "invalid" };

/**
 * The only path in this app that reads and writes without a session. It uses
 * the service-role connection because `email_unsubscribes` and `profiles` are
 * both closed to anon under RLS, and there is no session to carry — the
 * signature on the token is the boundary here, checked before anything is
 * touched and never taking a user id from the caller directly.
 */
async function withServiceRole<T>(run: (db: ReturnType<typeof createDrizzleSupabaseClient>["admin"]) => Promise<T>) {
  const client = createDrizzleSupabaseClient();
  try {
    return await run(client.admin);
  } finally {
    await client.end();
  }
}

export async function lookupUnsubscribe(token: string): Promise<UnsubscribeLookup> {
  const userId = await verifyUnsubscribeToken(token);
  if (!userId) return { status: "invalid" };

  return withServiceRole(async (db) => {
    const [profile] = await db
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile) return { status: "invalid" };

    const [existing] = await db
      .select({ userId: emailUnsubscribes.userId })
      .from(emailUnsubscribes)
      .where(eq(emailUnsubscribes.userId, userId))
      .limit(1);

    return { status: "ok", email: profile.email, alreadyUnsubscribed: Boolean(existing) };
  });
}

/**
 * A POST, not a link target. Mail clients and link scanners prefetch every URL
 * in a message, so unsubscribing on GET would opt people out because their
 * inbox looked at the email.
 */
export async function confirmUnsubscribe(token: string): Promise<UnsubscribeResult> {
  const userId = await verifyUnsubscribeToken(token);
  if (!userId) return { status: "invalid" };

  return withServiceRole(async (db) => {
    const inserted = await db
      .insert(emailUnsubscribes)
      .values({ userId })
      .onConflictDoNothing()
      .returning({ userId: emailUnsubscribes.userId });

    // Already on the list is the same outcome as newly added, but a user id
    // with no profile violates the foreign key rather than silently passing.
    if (inserted.length === 0) {
      const [existing] = await db
        .select({ userId: emailUnsubscribes.userId })
        .from(emailUnsubscribes)
        .where(eq(emailUnsubscribes.userId, userId))
        .limit(1);

      if (!existing) return { status: "invalid" };
    }

    return { status: "unsubscribed" };
  });
}
