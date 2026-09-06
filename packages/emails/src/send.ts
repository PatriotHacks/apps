import { emailSends, type DatabaseTransaction } from "@patriothacks/database";

import { type EmailProvider } from "./provider.ts";
import { renderTemplate, type StoredTemplate } from "./render.ts";
import { type TemplateContext, type TemplateKey } from "./templates.ts";

export type SendResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "failed"; error: string };

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * Renders a stored template, hands it to the provider and records the outcome
 * in `email_sends` — `provider_message_id` when the provider accepted it, the
 * failure reason when it did not. The row is written either way; a provider
 * outage must not also erase the evidence that a decision was mailed.
 *
 * `email_unsubscribes` is deliberately not consulted. These are transactional
 * decision and RSVP notices, not marketing — a rejection notice is owed to the
 * applicant whatever their broadcast preference.
 *
 * A template that references an undeclared variable throws before anything is
 * attempted. There is no subject to record at that point, and the editor's
 * save-time validation is what stops it reaching here.
 */
export async function sendTemplateEmail<K extends TemplateKey>({
  tx,
  provider,
  template,
  context,
  to,
  toUserId = null,
}: {
  tx: DatabaseTransaction;
  provider: EmailProvider;
  template: StoredTemplate<K>;
  context: TemplateContext<K>;
  to: string;
  toUserId?: string | null;
}): Promise<SendResult> {
  const { subject, html, text } = await renderTemplate(template, context);

  let result: SendResult;
  try {
    const { id } = await provider.send({ to, subject, html, text });
    result = { status: "sent", providerMessageId: id };
  } catch (cause) {
    result = { status: "failed", error: reason(cause) };
  }

  await tx.insert(emailSends).values({
    templateKey: template.key,
    toUserId,
    toEmail: to,
    subject,
    providerMessageId: result.status === "sent" ? result.providerMessageId : null,
    status: result.status,
    error: result.status === "failed" ? result.error : null,
    sentAt: result.status === "sent" ? new Date() : null,
  });

  return result;
}
