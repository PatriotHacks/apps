"use server";

import { emailTemplates } from "@patriothacks/database";
import {
  isTemplateKey,
  resendProviderFromEnv,
  sampleContext,
  sendTemplateEmail,
  unknownVariables,
  variablesFor,
} from "@patriothacks/emails";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";

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
