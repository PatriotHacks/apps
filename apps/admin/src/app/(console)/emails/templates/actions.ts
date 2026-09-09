"use server";

import { emailTemplates } from "@patriothacks/database";
import {
  compileNewsletter,
  customTemplateKey,
  isCustomTemplateKey,
  isTemplateKey,
  parseNewsletterBlocks,
  renderTemplate,
  resendProviderFromEnv,
  sampleContext,
  sendTemplateEmail,
  unknownVariables,
  variablesFor,
  type CustomTemplateKey,
  type NewsletterBlock,
} from "@patriothacks/emails";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { type BlockPreviewResult } from "@/lib/blocks";
import { queryAsStaff } from "@/lib/db";
import {
  deleteCustomTemplate,
  insertCustomTemplate,
  updateCustomTemplate,
  type CustomTemplateWrite,
} from "@/lib/email-templates";

export type TemplateDraft = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export type SaveTemplateResult =
  | { status: "saved" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

export type TestSendResult =
  | { status: "sent"; to: string }
  | { status: "failed"; message: string };

/** A custom template: an admin's label, its own subject, and the blocks it is built from. */
export type CustomTemplateDraft = {
  name: string;
  subject: string;
  blocks: NewsletterBlock[];
};

export type SaveCustomTemplateResult =
  | { status: "created"; key: string }
  | { status: "saved" }
  | { status: "invalid"; message: string };

export type DeleteTemplateResult =
  | { status: "deleted" }
  | { status: "invalid"; message: string };

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * Every write goes through `requireAdmin()` first. An organizer who replays this
 * action gets the same 403 the page gives them; the nav is presentation.
 */
export async function saveTemplate(
  key: string,
  draft: TemplateDraft,
): Promise<SaveTemplateResult> {
  const staff = await requireAdmin();
  if (!isTemplateKey(key)) return { status: "error", message: "Unknown template." };

  const subject = draft.subject.trim();
  const bodyHtml = draft.bodyHtml.trim();
  const bodyText = draft.bodyText.trim();

  if (!subject || !bodyHtml || !bodyText) {
    return { status: "invalid", message: "Subject, HTML body and text body are all required." };
  }

  // Caught here rather than at send time. A typo that reaches the send path
  // fails 800 rejection emails one by one; here it fails one save.
  const unknown = unknownVariables(key, subject, bodyHtml, bodyText);
  if (unknown.length > 0) {
    return {
      status: "invalid",
      message: `Unknown ${unknown.length === 1 ? "variable" : "variables"} ${unknown
        .map((name) => `{{${name}}}`)
        .join(", ")}. This template only has ${variablesFor(key)
        .map((name) => `{{${name}}}`)
        .join(", ")}.`,
    };
  }

  try {
    await queryAsStaff((tx) =>
      tx
        .update(emailTemplates)
        .set({ subject, bodyHtml, bodyText, updatedBy: staff.userId, updatedAt: new Date() })
        .where(eq(emailTemplates.key, key)),
    );
  } catch (cause) {
    return { status: "error", message: reason(cause) };
  }

  revalidatePath("/emails/templates");
  revalidatePath(`/emails/templates/${key}`);
  return { status: "saved" };
}

/**
 * Sends the template to the signed-in admin, filled from the sample context, so
 * a change is seen in a real inbox before an applicant sees it. Writes the same
 * `email_sends` row a real decision send would.
 */
export async function sendTestEmail(key: string): Promise<TestSendResult> {
  const staff = await requireAdmin();
  if (!isTemplateKey(key)) return { status: "failed", message: "Unknown template." };
  if (!staff.email) return { status: "failed", message: "Your account has no email address." };

  const to = staff.email;

  try {
    const provider = resendProviderFromEnv();

    return await queryAsStaff(async (tx): Promise<TestSendResult> => {
      const [row] = await tx
        .select({
          subject: emailTemplates.subject,
          bodyHtml: emailTemplates.bodyHtml,
          bodyText: emailTemplates.bodyText,
        })
        .from(emailTemplates)
        .where(eq(emailTemplates.key, key))
        .limit(1);

      if (!row) return { status: "failed", message: "That template is not in the database." };

      const result = await sendTemplateEmail({
        tx,
        provider,
        template: { key, ...row },
        context: sampleContext(key),
        to,
        toUserId: staff.userId,
      });

      return result.status === "sent" ? { status: "sent", to } : { status: "failed", message: result.error };
    });
  } catch (cause) {
    return { status: "failed", message: reason(cause) };
  }
}

type Checked =
  | { ok: true; key: CustomTemplateKey; write: CustomTemplateWrite }
  | { ok: false; message: string };

/**
 * The one gate for every custom-template write. The blocks arrive from the
 * browser, so they are parsed rather than trusted — that parse is what keeps a
 * `javascript:` URL out of an anchor — and the compiled output is checked against
 * the template's own key, which declares exactly the four variables a broadcast
 * can supply. Anything else fails one save here rather than every send later.
 *
 * `existing` is the key a saved template already has. A new one mints its key
 * from the name; a rename never touches it, because `email_sends` records it.
 */
function check(draft: CustomTemplateDraft, existing: CustomTemplateKey | null): Checked {
  const name = draft.name.trim();
  const subject = draft.subject.trim();

  if (!name) return { ok: false, message: "Give the template a name." };
  if (!subject) return { ok: false, message: "Give the template a subject." };

  const key = existing ?? customTemplateKey(name);
  if (!key) return { ok: false, message: "The name needs at least one letter or number in it." };

  const parsed = parseNewsletterBlocks(draft.blocks);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  if (parsed.blocks.length === 0) return { ok: false, message: "Add at least one block." };

  const { html, text } = compileNewsletter(parsed.blocks);
  const unknown = unknownVariables(key, subject, html, text);

  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unknown ${unknown.length === 1 ? "variable" : "variables"} ${unknown
        .map((variable) => `{{${variable}}}`)
        .join(", ")}. A template a broadcast can send only has ${variablesFor(key)
        .map((variable) => `{{${variable}}}`)
        .join(", ")}.`,
    };
  }

  return {
    ok: true,
    key,
    write: { name, subject, blocks: parsed.blocks, bodyHtml: html, bodyText: text },
  };
}

/**
 * The builder's live preview: compiled, filled from the sample context and poured
 * through the layout shell, so what the iframe shows is what a recipient would
 * read. Every failure comes back as a sentence rather than as a stack.
 */
export async function previewCustomTemplate(
  key: string | null,
  draft: CustomTemplateDraft,
): Promise<BlockPreviewResult> {
  await requireAdmin();

  const checked = check(draft, key !== null && isCustomTemplateKey(key) ? key : null);
  if (!checked.ok) return { status: "invalid", message: checked.message };

  const context = sampleContext(checked.key);

  try {
    const email = await renderTemplate(
      {
        key: checked.key,
        subject: checked.write.subject,
        bodyHtml: checked.write.bodyHtml,
        bodyText: checked.write.bodyText,
      },
      context,
      context.unsubscribe_url,
    );

    return { status: "ok", html: email.html, text: email.text };
  } catch (cause) {
    return { status: "invalid", message: reason(cause) };
  }
}

export async function createCustomTemplate(
  draft: CustomTemplateDraft,
): Promise<SaveCustomTemplateResult> {
  const staff = await requireAdmin();

  const checked = check(draft, null);
  if (!checked.ok) return { status: "invalid", message: checked.message };

  const key = await insertCustomTemplate(checked.key, checked.write, staff.userId);
  if (!key) {
    return {
      status: "invalid",
      message: `Another template already answers to ${checked.key}. Give this one a different name.`,
    };
  }

  revalidatePath("/emails/templates");
  return { status: "created", key };
}

export async function saveCustomTemplate(
  key: string,
  draft: CustomTemplateDraft,
): Promise<SaveCustomTemplateResult> {
  const staff = await requireAdmin();
  if (!isCustomTemplateKey(key)) return { status: "invalid", message: "Unknown template." };

  const checked = check(draft, key);
  if (!checked.ok) return { status: "invalid", message: checked.message };

  const found = await updateCustomTemplate(key, checked.write, staff.userId);
  if (!found) return { status: "invalid", message: "That template no longer exists." };

  revalidatePath("/emails/templates");
  revalidatePath(`/emails/templates/${key}`);
  return { status: "saved" };
}

/**
 * Deleting a template leaves every broadcast that loaded it untouched: the
 * compiled body was copied onto the broadcast row, so nothing sent or queued
 * depends on this row. The `email_sends` rows keep the key as written.
 */
export async function removeCustomTemplate(key: string): Promise<DeleteTemplateResult> {
  await requireAdmin();
  if (!isCustomTemplateKey(key)) return { status: "invalid", message: "Unknown template." };

  const found = await deleteCustomTemplate(key);
  if (!found) return { status: "invalid", message: "That template no longer exists." };

  revalidatePath("/emails/templates");
  return { status: "deleted" };
}
