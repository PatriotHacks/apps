import {
  emailSends,
  emailUnsubscribes,
  profiles,
  submissions,
  type DatabaseTransaction,
} from "@patriothacks/database";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { AudienceFilter } from "@/lib/broadcast-audience";

/**
 * What an audience filter compiles to.
 *
 * One definition of "who is in this audience", used by the live count at
 * compose time, by the preview, and by every chunk of the send. The count an
 * organizer reads before pressing send has to be the same set the send walks,
 * and the way to guarantee that is to only have one query.
 */

export type Recipient = {
  userId: string;
  email: string;
  fullName: string;
};

export type AudienceCount = {
  /** Distinct users the filter matches, before the unsubscribe list. */
  matched: number;
  /** How many of those opted out. Shown before sending, not discovered after. */
  unsubscribed: number;
  /** What will actually be mailed. */
  recipients: number;
};

/**
 * A draft is not an application. It is excluded unconditionally rather than
 * left to the status checkboxes, so no combination of them can mail someone
 * who never submitted.
 */
function audienceConditions(filter: AudienceFilter): SQL {
  const conditions: SQL[] = [sql`${submissions.status} <> 'draft'`];

  if (filter.formId) conditions.push(eq(submissions.formId, filter.formId));
  if (filter.statuses.length > 0) conditions.push(inArray(submissions.status, filter.statuses));
  if (filter.rsvpStatuses.length > 0) {
    conditions.push(inArray(submissions.rsvpStatus, filter.rsvpStatuses));
  }

  return and(...conditions) as SQL;
}

/**
 * The unsubscribe exclusion, written once and applied to every path that can
 * result in an email. Transactional decision and RSVP mail deliberately does
 * not import this — a rejection notice is not marketing.
 */
const notUnsubscribed = sql`not exists (
    select 1 from ${emailUnsubscribes}
    where ${emailUnsubscribes.userId} = ${submissions.userId}
  )`;

const countDistinctUsers = async (tx: DatabaseTransaction, where: SQL): Promise<number> => {
  const [row] = await tx
    .select({ n: sql<number>`count(distinct ${submissions.userId})::int` })
    .from(submissions)
    .where(where);

  return row?.n ?? 0;
};

/**
 * Two counts rather than one filtered aggregate: `matched` is the audience as
 * defined, `recipients` is the audience as sent. Their difference is the number
 * the compose screen has to state plainly, and computing it as a subtraction of
 * two queries over the same conditions is harder to get subtly wrong than a
 * single expression.
 */
export async function countAudience(
  tx: DatabaseTransaction,
  filter: AudienceFilter,
): Promise<AudienceCount> {
  const conditions = audienceConditions(filter);
  const matched = await countDistinctUsers(tx, conditions);
  const recipients = await countDistinctUsers(tx, and(conditions, notUnsubscribed) as SQL);

  return { matched, unsubscribed: matched - recipients, recipients };
}

/** `not exists` against this broadcast's own send rows — the resume marker. */
const notYetAttempted = (broadcastId: string) => sql`not exists (
    select 1 from ${emailSends}
    where ${emailSends.broadcastId} = ${broadcastId}
      and ${emailSends.toUserId} = ${submissions.userId}
  )`;

/** How many of the audience this broadcast has not tried yet. */
export function countRemaining(
  tx: DatabaseTransaction,
  filter: AudienceFilter,
  broadcastId: string,
): Promise<number> {
  return countDistinctUsers(
    tx,
    and(audienceConditions(filter), notUnsubscribed, notYetAttempted(broadcastId)) as SQL,
  );
}

/** What the broadcast has actually done so far, read off `email_sends`. */
export async function countAttempts(
  tx: DatabaseTransaction,
  broadcastId: string,
): Promise<{ sent: number; failed: number }> {
  const [row] = await tx
    .select({
      sent: sql<number>`count(*) filter (where ${emailSends.status} = 'sent')::int`,
      failed: sql<number>`count(*) filter (where ${emailSends.status} = 'failed')::int`,
    })
    .from(emailSends)
    .where(eq(emailSends.broadcastId, broadcastId));

  return { sent: row?.sent ?? 0, failed: row?.failed ?? 0 };
}

/**
 * The audience, resolved. `excludeSentFor` drops anyone who already has an
 * `email_sends` row for that broadcast, which is what makes the send resumable:
 * each chunk asks for "the next N nobody has tried yet" rather than tracking an
 * offset that a retry would misread.
 *
 * `full_name` falls back to the address because it is nullable and rendering
 * "Hi ," is worse than rendering an email address.
 */
export async function selectRecipients(
  tx: DatabaseTransaction,
  filter: AudienceFilter,
  options: { limit?: number; excludeSentFor?: string } = {},
): Promise<Recipient[]> {
  const conditions: SQL[] = [audienceConditions(filter), notUnsubscribed];

  if (options.excludeSentFor) conditions.push(notYetAttempted(options.excludeSentFor));

  const query = tx
    .selectDistinct({
      userId: profiles.id,
      email: profiles.email,
      fullName: sql<string>`coalesce(${profiles.fullName}, ${profiles.email})`,
    })
    .from(submissions)
    .innerJoin(profiles, eq(profiles.id, submissions.userId))
    .where(and(...conditions))
    // Stable across chunks, and required by `select distinct`.
    .orderBy(profiles.id);

  return options.limit === undefined ? query : query.limit(options.limit);
}
