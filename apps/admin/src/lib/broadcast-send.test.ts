import {
  broadcasts,
  createDrizzleSupabaseClient,
  emailSends,
  emailUnsubscribes,
  forms,
  submissions,
  type Database,
  type DatabaseTransaction,
} from "@patriothacks/database";
import { sendTemplateEmail, type EmailProvider } from "@patriothacks/emails";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type AudienceFilter } from "@/lib/broadcast-audience";
import { BROADCAST_BATCH_SIZE, sendBroadcastChunk } from "@/lib/broadcast-send";
import { countAudience, selectRecipients } from "@/lib/broadcast-sql";

/**
 * The unsubscribe guarantee, proved against a real database rather than
 * asserted in a comment.
 *
 * A broadcast that mails someone who opted out is the worst bug this feature
 * can have, and it is invisible from the console: the count looks right, the
 * send looks successful, and the only evidence is in someone else's inbox. So
 * the check here is on `email_sends` — the rows that would have been the
 * emails — not on anything the UI reports.
 *
 * Everything it creates lives under one uuid prefix and one throwaway form, so
 * it can run against a shared database without touching anyone else's rows.
 */

const HAS_DB = Boolean(process.env.DATABASE_URL) && process.env.BROADCAST_DB_TESTS === "1";

const PREFIX = "6a000000-0000-4000-8000-";
const id = (n: number) => `${PREFIX}${String(n).padStart(12, "0")}`;

const FORM_ID = id(1);
const BROADCAST_ID = id(2);
const FAILING_BROADCAST_ID = id(3);

/** 520 so the batch loop has to run more than ten times. */
const POPULATION = 520;
const UNSUBSCRIBED = 40;

const userId = (n: number) => id(1000 + n);
const emailFor = (n: number) => `broadcast-test-${n}@example.invalid`;

const filter: AudienceFilter = { formId: FORM_ID, statuses: [], rsvpStatuses: [] };

const stubProvider = (): EmailProvider & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    send: ({ to }) => {
      calls.push(to);
      return Promise.resolve({ id: `stub_${calls.length}` });
    },
  };
};

/** Rejects for a named subset, so a partial failure can be inspected. */
const flakyProvider = (failFor: Set<string>): EmailProvider => ({
  send: ({ to }) =>
    failFor.has(to)
      ? Promise.reject(new Error("validation_error: recipient rejected"))
      : Promise.resolve({ id: "stub_ok" }),
});

let client: ReturnType<typeof createDrizzleSupabaseClient>;
let db: Database;

/**
 * The engine takes a transaction; these tests give it a plain service-role
 * connection, which satisfies the same interface. RLS is not what is under
 * test here — the `not exists` against `email_unsubscribes` is.
 */
const tx = () => db as unknown as DatabaseTransaction;

async function seed() {
  await db.execute(sql`
    insert into ${forms} (id, slug, title, status, published_at)
    values (${FORM_ID}, 'broadcast-test-form', 'Broadcast Test Form', 'published', now())
    on conflict (id) do nothing
  `);

  // One statement rather than 520: the `handle_new_user` trigger creates the
  // matching `profiles` row for each, which is what the audience joins to.
  const people = Array.from(
    { length: POPULATION },
    (_, n) => sql`(
      '00000000-0000-0000-0000-000000000000', ${userId(n)}::uuid, 'authenticated', 'authenticated',
      ${emailFor(n)}, 'x', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', ${`Recipient ${n}`}::text),
      now(), now(), '', '', '', ''
    )`,
  );

  await db.execute(sql`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values ${sql.join(people, sql`, `)}
    on conflict (id) do nothing
  `);

  await db.insert(submissions).values(
    Array.from({ length: POPULATION }, (_, n) => ({
      formId: FORM_ID,
      userId: userId(n),
      status: "submitted" as const,
      submittedAt: new Date(),
    })),
  );

  // Every thirteenth person opts out.
  await db.insert(emailUnsubscribes).values(
    Array.from({ length: UNSUBSCRIBED }, (_, n) => ({ userId: userId(n * 13) })),
  );

  await db.insert(broadcasts).values([
    {
      id: BROADCAST_ID,
      name: "Broadcast test",
      subject: "Check-in for {{full_name}}",
      bodyHtml: "<p>Hi {{full_name}}.</p>",
      bodyText: "Hi {{full_name}}.",
      audienceFilter: filter,
      status: "sending",
    },
    {
      id: FAILING_BROADCAST_ID,
      name: "Broadcast test — partial failure",
      subject: "Check-in",
      bodyHtml: "<p>Hi {{full_name}}.</p>",
      bodyText: "Hi {{full_name}}.",
      audienceFilter: filter,
      status: "sending",
    },
  ]);
}

async function cleanup() {
  const ids = Array.from({ length: POPULATION }, (_, n) => userId(n));

  await db.delete(emailSends).where(inArray(emailSends.broadcastId, [BROADCAST_ID, FAILING_BROADCAST_ID]));
  await db.delete(emailSends).where(inArray(emailSends.toUserId, ids));
  await db.delete(broadcasts).where(inArray(broadcasts.id, [BROADCAST_ID, FAILING_BROADCAST_ID]));
  await db.delete(emailUnsubscribes).where(inArray(emailUnsubscribes.userId, ids));
  await db.delete(submissions).where(eq(submissions.formId, FORM_ID));
  await db.delete(forms).where(eq(forms.id, FORM_ID));
  // The profiles row goes with the auth user via `on delete cascade`.
  await db.execute(sql`delete from auth.users where id::text like ${`${PREFIX}%`}`);
}

const unsubscribedIds = Array.from({ length: UNSUBSCRIBED }, (_, n) => userId(n * 13));

describe.skipIf(!HAS_DB)("broadcast sending against the database", () => {
  beforeAll(async () => {
    client = createDrizzleSupabaseClient();
    db = client.admin;
    await cleanup();
    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await client.end();
  });

  it("counts the audience and states how many the unsubscribe list removes", async () => {
    const count = await countAudience(tx(), filter);

    expect(count.matched).toBe(POPULATION);
    expect(count.unsubscribed).toBe(UNSUBSCRIBED);
    expect(count.recipients).toBe(POPULATION - UNSUBSCRIBED);
  });

  it("never hands an unsubscribed user to the send path", async () => {
    const recipients = await selectRecipients(tx(), filter);
    const resolved = new Set(recipients.map((r) => r.userId));

    expect(recipients).toHaveLength(POPULATION - UNSUBSCRIBED);
    for (const excluded of unsubscribedIds) expect(resolved.has(excluded)).toBe(false);
  });

  it("writes zero email_sends rows for anyone who unsubscribed", async () => {
    const provider = stubProvider();
    const chunkSizes: number[] = [];

    let before = provider.calls.length;
    let progress = await sendBroadcastChunk({
      tx: tx(),
      provider,
      broadcastId: BROADCAST_ID,
      filter,
      subject: "Check-in for {{full_name}}",
      bodyHtml: "<p>Hi {{full_name}}.</p>",
      bodyText: "Hi {{full_name}}.",
      unsubscribeUrlFor: (user) => Promise.resolve(`https://admin.test/unsubscribe?token=${user}`),
    });
    chunkSizes.push(provider.calls.length - before);

    while (progress.remaining > 0) {
      before = provider.calls.length;
      progress = await sendBroadcastChunk({
        tx: tx(),
        provider,
        broadcastId: BROADCAST_ID,
        filter,
        subject: "Check-in for {{full_name}}",
        bodyHtml: "<p>Hi {{full_name}}.</p>",
        bodyText: "Hi {{full_name}}.",
        unsubscribeUrlFor: (user) => Promise.resolve(`https://admin.test/unsubscribe?token=${user}`),
      });
      chunkSizes.push(provider.calls.length - before);
    }

    // No request carried the whole audience.
    expect(Math.max(...chunkSizes)).toBeLessThanOrEqual(BROADCAST_BATCH_SIZE);
    expect(chunkSizes.length).toBeGreaterThan(1);

    // The claim, queried rather than reported: not one row for an opted-out user.
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(emailSends)
      .where(
        and(eq(emailSends.broadcastId, BROADCAST_ID), inArray(emailSends.toUserId, unsubscribedIds)),
      );

    expect(count?.n).toBe(0);

    // And the audience that was counted is the audience that was mailed.
    const [totals] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(emailSends)
      .where(eq(emailSends.broadcastId, BROADCAST_ID));

    expect(totals?.total).toBe(POPULATION - UNSUBSCRIBED);

    const [row] = await db.select().from(broadcasts).where(eq(broadcasts.id, BROADCAST_ID));
    expect(row?.status).toBe("sent");
    expect(row?.sentAt).not.toBeNull();
  });

  it("still delivers transactional mail to someone who unsubscribed", async () => {
    const optedOut = unsubscribedIds[0]!;

    const result = await sendTemplateEmail({
      tx: tx(),
      provider: stubProvider(),
      template: {
        key: "decision_rejected",
        subject: "PatriotHacks {{year}} application update",
        bodyHtml: "<p>Hi {{full_name}}.</p>",
        bodyText: "Hi {{full_name}}.",
      },
      context: { full_name: "Recipient", form_title: "Broadcast Test Form", year: "2026" },
      to: emailFor(0),
      toUserId: optedOut,
    });

    expect(result.status).toBe("sent");

    // The asymmetry, both halves in one place: a broadcast row for this user
    // does not exist, a transactional row does.
    const rows = await db
      .select({ broadcastId: emailSends.broadcastId, templateKey: emailSends.templateKey })
      .from(emailSends)
      .where(eq(emailSends.toUserId, optedOut));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ broadcastId: null, templateKey: "decision_rejected" });
  });

  it("records a mid-batch failure rather than losing it", async () => {
    const recipients = await selectRecipients(tx(), filter, { limit: BROADCAST_BATCH_SIZE });
    const doomed = new Set(recipients.slice(0, 3).map((r) => r.email));

    const progress = await sendBroadcastChunk({
      tx: tx(),
      provider: flakyProvider(doomed),
      broadcastId: FAILING_BROADCAST_ID,
      filter,
      subject: "Check-in",
      bodyHtml: "<p>Hi {{full_name}}.</p>",
      bodyText: "Hi {{full_name}}.",
      unsubscribeUrlFor: (user) => Promise.resolve(`https://admin.test/unsubscribe?token=${user}`),
    });

    expect(progress.failed).toBe(3);
    expect(progress.sent).toBe(BROADCAST_BATCH_SIZE - 3);
    expect(progress.remaining).toBeGreaterThan(0);

    const failures = await db
      .select({ toEmail: emailSends.toEmail, error: emailSends.error })
      .from(emailSends)
      .where(
        and(eq(emailSends.broadcastId, FAILING_BROADCAST_ID), eq(emailSends.status, "failed")),
      );

    expect(failures).toHaveLength(3);
    expect(new Set(failures.map((f) => f.toEmail))).toEqual(doomed);
    for (const failure of failures) {
      expect(failure.error).toContain("recipient rejected");
    }

    // A failed recipient is not retried by the next chunk — the row is the
    // record that they were attempted, whichever way it went.
    const next = await selectRecipients(tx(), filter, {
      limit: BROADCAST_BATCH_SIZE,
      excludeSentFor: FAILING_BROADCAST_ID,
    });

    expect(next.some((r) => doomed.has(r.email))).toBe(false);
  });

  it("marks a broadcast failed when any recipient failed", async () => {
    let progress = await sendBroadcastChunk({
      tx: tx(),
      provider: stubProvider(),
      broadcastId: FAILING_BROADCAST_ID,
      filter,
      subject: "Check-in",
      bodyHtml: "<p>Hi {{full_name}}.</p>",
      bodyText: "Hi {{full_name}}.",
      unsubscribeUrlFor: (user) => Promise.resolve(`https://admin.test/unsubscribe?token=${user}`),
    });

    while (progress.remaining > 0) {
      progress = await sendBroadcastChunk({
        tx: tx(),
        provider: stubProvider(),
        broadcastId: FAILING_BROADCAST_ID,
        filter,
        subject: "Check-in",
        bodyHtml: "<p>Hi {{full_name}}.</p>",
        bodyText: "Hi {{full_name}}.",
        unsubscribeUrlFor: (user) => Promise.resolve(`https://admin.test/unsubscribe?token=${user}`),
      });
    }

    expect(progress.status).toBe("failed");
    expect(progress.failed).toBe(3);
    expect(progress.sent).toBe(POPULATION - UNSUBSCRIBED - 3);

    const [row] = await db.select().from(broadcasts).where(eq(broadcasts.id, FAILING_BROADCAST_ID));
    expect(row?.status).toBe("failed");

    // Still nobody who unsubscribed, on the failing run either.
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(emailSends)
      .where(
        and(
          eq(emailSends.broadcastId, FAILING_BROADCAST_ID),
          inArray(emailSends.toUserId, unsubscribedIds),
        ),
      );

    expect(count?.n).toBe(0);
  });

  it("leaves nobody behind who unsubscribed after the send began", async () => {
    // Resolution happens per chunk, so an opt-out mid-send takes effect for the
    // chunks that follow it rather than being frozen at compose time.
    const late = userId(7);
    await db.insert(emailUnsubscribes).values({ userId: late }).onConflictDoNothing();

    const recipients = await selectRecipients(tx(), filter);
    expect(recipients.some((r) => r.userId === late)).toBe(false);

    await db.delete(emailUnsubscribes).where(eq(emailUnsubscribes.userId, late));
  });
});
