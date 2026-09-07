import { broadcasts, type DatabaseTransaction } from "@patriothacks/database";
import {
  BROADCAST_KEY,
  sendTemplateEmail,
  type EmailProvider,
} from "@patriothacks/emails";
import { eq } from "drizzle-orm";

import type { AudienceFilter } from "@/lib/broadcast-audience";
import { countAttempts, countRemaining, selectRecipients } from "@/lib/broadcast-sql";

/**
 * One chunk per request, never the whole audience.
 *
 * At 2000 recipients a single handler that looped over all of them would blow
 * the Worker CPU budget long before it finished, and a timeout halfway through
 * would leave nobody able to say who had been mailed. So a send is a sequence
 * of bounded requests: each one asks the database for the next recipients with
 * no `email_sends` row for this broadcast, mails them, and returns. Progress
 * lives in `email_sends`, which means an interrupted send resumes exactly where
 * it stopped and a retry cannot double-send.
 */
export const BROADCAST_BATCH_SIZE = 50;

/**
 * Provider calls per chunk that are in flight at once. The bottleneck is the
 * provider's round trip, not CPU, so this is what turns 50 sequential HTTP
 * calls into five rounds of ten. The row writes queue on the single pooled
 * connection behind them, which is fine — they are milliseconds each.
 */
export const BROADCAST_CONCURRENCY = 10;

export type BroadcastProgress = {
  status: (typeof broadcasts.status.enumValues)[number];
  sent: number;
  failed: number;
  remaining: number;
};

async function inParallel<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await run(item);
    }
  });

  await Promise.all(workers);
}

/**
 * Mails the next batch of the audience and reports where the send now stands.
 *
 * The audience is resolved here rather than at compose time — the set moves as
 * decisions are issued and as people unsubscribe, and the honest answer to "who
 * gets this" is the one true at the moment of sending.
 *
 * `unsubscribeUrlFor` is injected rather than imported so this stays callable
 * outside a request, which is what lets a test exercise the whole path with a
 * stubbed provider.
 */
export async function sendBroadcastChunk({
  tx,
  provider,
  broadcastId,
  filter,
  subject,
  bodyHtml,
  bodyText,
  unsubscribeUrlFor,
  year = String(new Date().getUTCFullYear()),
}: {
  tx: DatabaseTransaction;
  provider: EmailProvider;
  broadcastId: string;
  filter: AudienceFilter;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  unsubscribeUrlFor: (userId: string) => Promise<string>;
  year?: string;
}): Promise<BroadcastProgress> {
  const recipients = await selectRecipients(tx, filter, {
    limit: BROADCAST_BATCH_SIZE,
    excludeSentFor: broadcastId,
  });

  await inParallel(recipients, BROADCAST_CONCURRENCY, async (recipient) => {
    const unsubscribeUrl = await unsubscribeUrlFor(recipient.userId);

    // Writes an `email_sends` row whichever way the provider answers, so a
    // failure mid-batch is recorded rather than merely absent.
    await sendTemplateEmail({
      tx,
      provider,
      template: { key: BROADCAST_KEY, subject, bodyHtml, bodyText },
      context: {
        full_name: recipient.fullName,
        email: recipient.email,
        year,
        unsubscribe_url: unsubscribeUrl,
      },
      to: recipient.email,
      toUserId: recipient.userId,
      broadcastId,
      unsubscribeUrl,
    });
  });

  const remaining = await countRemaining(tx, filter, broadcastId);
  const { sent, failed } = await countAttempts(tx, broadcastId);

  if (remaining > 0) return { status: "sending", sent, failed, remaining };

  // Any failure at all marks the broadcast failed. A run that reaches the end
  // with three rejections is not "sent" — the detail view names the three, and
  // a status that said otherwise would hide them.
  const status = failed > 0 ? "failed" : "sent";

  await tx
    .update(broadcasts)
    .set({ status, sentAt: new Date() })
    .where(eq(broadcasts.id, broadcastId));

  return { status, sent, failed, remaining: 0 };
}
