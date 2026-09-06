import {
  broadcasts,
  emailSends,
  forms,
  type DatabaseTransaction,
} from "@patriothacks/database";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { parseAudienceFilter, type AudienceFilter } from "@/lib/broadcast-audience";
import { queryAsAdmin } from "@/lib/db";
import { isUuid } from "@/lib/form-definition";

/**
 * `$count` rather than a raw subquery: inside one, drizzle emits the outer
 * column unqualified and `broadcast_id = id` binds to the inner table, which
 * returns 0 for every row.
 */
const sendCount = (tx: DatabaseTransaction, status: "sent" | "failed") =>
  tx.$count(emailSends, and(eq(emailSends.broadcastId, broadcasts.id), eq(emailSends.status, status)));

export function listBroadcasts() {
  return queryAsAdmin((tx) =>
    tx
      .select({
        id: broadcasts.id,
        name: broadcasts.name,
        subject: broadcasts.subject,
        status: broadcasts.status,
        recipientCount: broadcasts.recipientCount,
        createdAt: broadcasts.createdAt,
        sentAt: broadcasts.sentAt,
        sent: sendCount(tx, "sent"),
        failed: sendCount(tx, "failed"),
      })
      .from(broadcasts)
      .orderBy(desc(broadcasts.createdAt)),
  );
}

export type BroadcastListRow = Awaited<ReturnType<typeof listBroadcasts>>[number];

export type BroadcastDetail = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: (typeof broadcasts.status.enumValues)[number];
  recipientCount: number;
  createdAt: Date;
  sentAt: Date | null;
  filter: AudienceFilter;
  formTitle: string | null;
  sends: {
    toEmail: string;
    status: (typeof emailSends.status.enumValues)[number];
    error: string | null;
    sentAt: Date | null;
    createdAt: Date;
  }[];
  sentCount: number;
  failedCount: number;
};

export async function getBroadcast(id: string): Promise<BroadcastDetail | null> {
  if (!isUuid(id)) return null;

  return queryAsAdmin(async (tx) => {
    const [row] = await tx.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
    if (!row) return null;

    const filter = parseAudienceFilter(row.audienceFilter);

    const [form] = filter.formId
      ? await tx
          .select({ title: forms.title })
          .from(forms)
          .where(eq(forms.id, filter.formId))
          .limit(1)
      : [];

    // Every attempt, successes and failures together. A partial send is only
    // legible if the failures are listed beside the reason they failed.
    const sends = await tx
      .select({
        toEmail: emailSends.toEmail,
        status: emailSends.status,
        error: emailSends.error,
        sentAt: emailSends.sentAt,
        createdAt: emailSends.createdAt,
      })
      .from(emailSends)
      .where(eq(emailSends.broadcastId, id))
      .orderBy(asc(emailSends.status), asc(emailSends.toEmail));

    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      status: row.status,
      recipientCount: row.recipientCount,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      filter,
      formTitle: form?.title ?? null,
      sends,
      sentCount: sends.filter((send) => send.status === "sent").length,
      failedCount: sends.filter((send) => send.status === "failed").length,
    };
  });
}

/** The form picker in the audience builder. */
export function listFormChoices() {
  return queryAsAdmin((tx) =>
    tx
      .select({ id: forms.id, title: forms.title })
      .from(forms)
      .where(isNull(forms.deletedAt))
      .orderBy(desc(forms.createdAt)),
  );
}
