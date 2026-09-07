"use server";

import { broadcasts } from "@patriothacks/database";
import {
  BROADCAST_KEY,
  renderTemplate,
  resendProviderFromEnv,
  unknownVariables,
  variablesFor,
} from "@patriothacks/emails";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { parseAudienceFilter, type AudienceFilter } from "@/lib/broadcast-audience";
import { sendBroadcastChunk, type BroadcastProgress } from "@/lib/broadcast-send";
import { countAudience, selectRecipients, type AudienceCount } from "@/lib/broadcast-sql";
import { queryAsAdmin } from "@/lib/db";
import { unsubscribeUrlFor } from "@/lib/unsubscribe";

export type BroadcastDraft = {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export type CreateBroadcastResult =
  | { status: "created"; id: string }
  | { status: "invalid"; message: string };

export type PreviewResult =
  | { status: "ok"; to: string; subject: string; html: string; text: string }
  | { status: "empty" }
  | { status: "invalid"; message: string };

export type SendProgressResult =
  | { ok: true; progress: BroadcastProgress }
  | { ok: false; message: string };

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * The same save-time gate the template editor uses. A placeholder the broadcast
 * key does not declare fails one save here rather than 800 sends later.
 */
function validate(draft: BroadcastDraft): string | null {
  if (!draft.name.trim()) return "Give the broadcast a name.";
  if (!draft.subject.trim() || !draft.bodyHtml.trim() || !draft.bodyText.trim()) {
    return "Subject, HTML body and text body are all required.";
  }

  const unknown = unknownVariables(BROADCAST_KEY, draft.subject, draft.bodyHtml, draft.bodyText);
  if (unknown.length === 0) return null;

  return `Unknown ${unknown.length === 1 ? "variable" : "variables"} ${unknown
    .map((name) => `{{${name}}}`)
    .join(", ")}. A broadcast only has ${variablesFor(BROADCAST_KEY)
    .map((name) => `{{${name}}}`)
    .join(", ")}.`;
}

/** Live count for the builder, including the number the unsubscribe list removes. */
export async function previewAudience(filter: AudienceFilter): Promise<AudienceCount> {
  await requireAdmin();
  const parsed = parseAudienceFilter(filter);
  return queryAsAdmin((tx) => countAudience(tx, parsed));
}

/**
 * Rendered against a real member of the audience rather than a sample context —
 * the point is to see what one specific person will read, interpolation and
 * all, before anyone reads it.
 */
export async function previewBroadcast(
  draft: BroadcastDraft,
  filter: AudienceFilter,
): Promise<PreviewResult> {
  await requireAdmin();

  const invalid = validate(draft);
  if (invalid) return { status: "invalid", message: invalid };

  const parsed = parseAudienceFilter(filter);
  const [recipient] = await queryAsAdmin((tx) => selectRecipients(tx, parsed, { limit: 1 }));
  if (!recipient) return { status: "empty" };

  try {
    const unsubscribeUrl = await unsubscribeUrlFor(recipient.userId);
    const email = await renderTemplate(
      { key: BROADCAST_KEY, ...draft },
      {
        full_name: recipient.fullName,
        email: recipient.email,
        year: String(new Date().getUTCFullYear()),
        unsubscribe_url: unsubscribeUrl,
      },
      unsubscribeUrl,
    );

    return { status: "ok", to: recipient.email, ...email };
  } catch (cause) {
    return { status: "invalid", message: reason(cause) };
  }
}

export async function createBroadcast(
  draft: BroadcastDraft,
  filter: AudienceFilter,
): Promise<CreateBroadcastResult> {
  const staff = await requireAdmin();

  const invalid = validate(draft);
  if (invalid) return { status: "invalid", message: invalid };

  const [row] = await queryAsAdmin((tx) =>
    tx
      .insert(broadcasts)
      .values({
        name: draft.name.trim(),
        subject: draft.subject.trim(),
        bodyHtml: draft.bodyHtml.trim(),
        bodyText: draft.bodyText.trim(),
        // Stored as written, so "who was this for?" stays answerable later.
        audienceFilter: parseAudienceFilter(filter),
        status: "draft",
        createdBy: staff.userId,
      })
      .returning({ id: broadcasts.id }),
  );

  if (!row) return { status: "invalid", message: "The broadcast could not be saved." };

  revalidatePath("/emails/broadcasts");
  return { status: "created", id: row.id };
}

/**
 * Flips a draft into `sending` and records how many people that means, resolved
 * now rather than when the broadcast was written. Sends nothing itself; the
 * first chunk follows.
 */
export async function startBroadcast(id: string): Promise<SendProgressResult> {
  await requireAdmin();

  try {
    return await queryAsAdmin(async (tx): Promise<SendProgressResult> => {
      const [row] = await tx.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
      if (!row) return { ok: false, message: "That broadcast does not exist." };
      if (row.status !== "draft") {
        return { ok: false, message: `This broadcast is already ${row.status}.` };
      }

      const { recipients } = await countAudience(tx, parseAudienceFilter(row.audienceFilter));
      if (recipients === 0) {
        return { ok: false, message: "This audience has no recipients left to mail." };
      }

      await tx
        .update(broadcasts)
        .set({ status: "sending", recipientCount: recipients })
        .where(eq(broadcasts.id, id));

      return {
        ok: true,
        progress: { status: "sending", sent: 0, failed: 0, remaining: recipients },
      };
    });
  } catch (cause) {
    return { ok: false, message: reason(cause) };
  }
}

/**
 * One batch per call. The detail view calls this in a loop until nothing is
 * left, so no single request carries more than one batch of sends and a closed
 * tab leaves a broadcast that can be resumed rather than one nobody can
 * account for.
 */
export async function continueBroadcast(id: string): Promise<SendProgressResult> {
  await requireAdmin();

  try {
    const provider = resendProviderFromEnv();

    return await queryAsAdmin(async (tx): Promise<SendProgressResult> => {
      const [row] = await tx.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
      if (!row) return { ok: false, message: "That broadcast does not exist." };
      if (row.status !== "sending") {
        return { ok: false, message: `This broadcast is ${row.status}, not sending.` };
      }

      const progress = await sendBroadcastChunk({
        tx,
        provider,
        broadcastId: id,
        filter: parseAudienceFilter(row.audienceFilter),
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        bodyText: row.bodyText,
        unsubscribeUrlFor,
      });

      revalidatePath("/emails/broadcasts");
      revalidatePath(`/emails/broadcasts/${id}`);
      return { ok: true, progress };
    });
  } catch (cause) {
    return { ok: false, message: reason(cause) };
  }
}
