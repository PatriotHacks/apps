import { emailSends, type DatabaseTransaction } from "@patriothacks/database";

import { type EmailProvider } from "./provider.ts";
import { renderTemplate, type StoredTemplate } from "./render.ts";
import { isTemplateKey, type MessageKey, type TemplateContext } from "./templates.ts";

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
 * `email_unsubscribes` is deliberately not consulted *here*. Transactional
 * decision and RSVP notices are not marketing — a rejection notice is owed to
 * the applicant whatever their broadcast preference. Broadcasts respect the
 * list, and they do it by never handing an unsubscribed recipient to this
 * function: the exclusion belongs to audience resolution, where it is one
 * query rather than a per-call flag someone can forget to pass.
 *
 * A template that references an undeclared variable throws before anything is
 * attempted. There is no subject to record at that point, and the editor's
 * save-time validation is what stops it reaching here.
 */
export async function sendTemplateEmail<K extends MessageKey>({
  tx,
  provider,
  template,
  context,
  to,
  toUserId = null,
  broadcastId = null,
  unsubscribeUrl,
}: {
  tx: DatabaseTransaction;
  provider: EmailProvider;
  template: StoredTemplate<K>;
  context: TemplateContext<K>;
  to: string;
  toUserId?: string | null;
  broadcastId?: string | null;
  unsubscribeUrl?: string | undefined;
}): Promise<SendResult> {
  const { subject, html, text } = await renderTemplate(template, context, unsubscribeUrl);

  let result: SendResult;
  try {
    const { id } = await provider.send({ to, subject, html, text });
    result = { status: "sent", providerMessageId: id };
  } catch (cause) {
    result = { status: "failed", error: reason(cause) };
  }

  await tx.insert(emailSends).values({
    // A broadcast's words live on the `broadcasts` row, not in
    // `email_templates`, so it has no template key to record.
    templateKey: isTemplateKey(template.key) ? template.key : null,
    broadcastId,
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
