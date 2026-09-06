import { createDrizzleSupabaseClient, emailTemplates } from "@patriothacks/database";
import { resendProviderFromEnv, sendTemplateEmail, type SendResult } from "@patriothacks/emails";
import { eq } from "drizzle-orm";

/**
 * The one place in this app that steps outside RLS, and it is as narrow as it
 * can be made.
 *
 * `email_templates` and `email_sends` are admin-only by policy — applicants
 * never read or write them. But an applicant confirming their spot is the event
 * that owes them a confirmation, so the send has to happen inside their
 * request. It runs on the service-role connection with no caller-supplied
 * table, column or template: the key is a constant, the recipient is whoever
 * the verified session says it is, and the only writes are the `email_sends`
 * row `sendTemplateEmail` records.
 *
 * The `rls/no-admin-db-client` rule is disabled on exactly one line below,
 * because a blanket ban here would be answered by a worse workaround.
 */
export async function sendRsvpConfirmation({
  to,
  toUserId,
  fullName,
  formTitle,
}: {
  to: string;
  toUserId: string;
  fullName: string;
  formTitle: string;
}): Promise<SendResult> {
  const provider = resendProviderFromEnv();
  const client = createDrizzleSupabaseClient({ role: "service_role" });

  try {
    // eslint-disable-next-line rls/no-admin-db-client -- see the note above: the email tables are admin-only by policy and this send has no caller-controlled surface.
    const db = client.admin;

    return await db.transaction(async (tx) => {
      const [stored] = await tx
        .select({
          subject: emailTemplates.subject,
          bodyHtml: emailTemplates.bodyHtml,
          bodyText: emailTemplates.bodyText,
        })
        .from(emailTemplates)
        .where(eq(emailTemplates.key, "rsvp_confirmed"))
        .limit(1);

      if (!stored) return { status: "failed", error: "Template rsvp_confirmed is missing." };

      return sendTemplateEmail({
        tx,
        provider,
        template: { key: "rsvp_confirmed", ...stored },
        context: {
          full_name: fullName,
          form_title: formTitle,
          year: String(new Date().getUTCFullYear()),
        },
        to,
        toUserId,
      });
    });
  } finally {
    await client.end();
  }
}
