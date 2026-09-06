"use server";

import {
  emailTemplates,
  forms,
  profiles,
  submissionReviews,
  submissions,
} from "@patriothacks/database";
import { resendProviderFromEnv, sendTemplateEmail } from "@patriothacks/emails";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin, requireStaff } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";
import { isDecidable, isDecisionStatus, isSettableStatus, rsvpUrl } from "@/lib/decisions";
import { isUuid } from "@/lib/form-definition";

/**
 * Deciding and notifying are two acts, and this file keeps them two requests.
 *
 * `setSubmissionStatus` commits the decision on its own. `sendDecisionEmail`
 * never writes to `submissions`. So a provider outage cannot take a recorded
 * decision down with it — there is no transaction spanning the two to roll
 * back, and an admin who decides today can notify next week.
 */

export type NoteResult = { status: "saved" } | { status: "error"; message: string };

export type StatusResult =
  | { status: "updated"; value: string }
  | { status: "error"; message: string };

export type DecisionEmailResult =
  | { status: "sent"; to: string }
  | { status: "failed"; message: string };

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * Upsert the caller's own note. Organizers write these too — review is
 * free-for-all, and a submission carries one note per reviewer.
 *
 * There is deliberately no reviewer parameter: the row is keyed on the verified
 * session's user id, so a forged request has nothing to point at someone else's
 * note. `submission_reviews_update_own` refuses it in Postgres as well, which
 * is what makes that true even if this function is bypassed entirely.
 */
export async function saveReviewNote(submissionId: string, notes: string): Promise<NoteResult> {
  const staff = await requireStaff();
  if (!isUuid(submissionId)) return { status: "error", message: "Unknown submission." };

  const text = notes.trim();
  if (text === "") return { status: "error", message: "A note needs some words in it." };

  try {
    await queryAsStaff((tx) =>
      tx
        .insert(submissionReviews)
        .values({ submissionId, reviewerId: staff.userId, notes: text })
        .onConflictDoUpdate({
          target: [submissionReviews.submissionId, submissionReviews.reviewerId],
          set: { notes: text, updatedAt: new Date() },
        }),
    );
  } catch (cause) {
    return { status: "error", message: reason(cause) };
  }

  revalidatePath(`/submissions/${submissionId}`);
  return { status: "saved" };
}

/**
 * Move one application along the pipeline. Admin only — an organizer who posts
 * straight at this action takes the same 403 the page would give them.
 *
 * A decision stamps `decided_at` and `decided_by`; sending an application back
 * to review clears both, because a stamp describing a decision that no longer
 * stands is worse than no stamp at all.
 */
export async function setSubmissionStatus(
  submissionId: string,
  status: string,
): Promise<StatusResult> {
  const staff = await requireAdmin();
  if (!isUuid(submissionId)) return { status: "error", message: "Unknown submission." };
  if (!isSettableStatus(status)) {
    return { status: "error", message: "That is not a status the console can set." };
  }

  try {
    const outcome = await queryAsStaff(async (tx): Promise<StatusResult> => {
      const [row] = await tx
        .select({ status: submissions.status })
        .from(submissions)
        .where(eq(submissions.id, submissionId))
        .limit(1);
      if (!row) return { status: "error", message: "Unknown submission." };

      if (!isDecidable(row.status)) {
        return {
          status: "error",
          message: `A ${row.status.replaceAll("_", " ")} application is not in the pile to decide.`,
        };
      }

      const decided = isDecisionStatus(status);
      await tx
        .update(submissions)
        .set({
          status,
          decidedAt: decided ? new Date() : null,
          decidedBy: decided ? staff.userId : null,
          updatedAt: new Date(),
        })
        .where(eq(submissions.id, submissionId));

      return { status: "updated", value: status };
    });

    if (outcome.status === "updated") revalidatePath(`/submissions/${submissionId}`);
    return outcome;
  } catch (cause) {
    return { status: "error", message: reason(cause) };
  }
}

/**
 * Send the template matching the decision already on the row.
 *
 * The status is read from the database rather than passed in, so this can only
 * ever tell an applicant what the record actually says.
 */
export async function sendDecisionEmail(submissionId: string): Promise<DecisionEmailResult> {
  await requireAdmin();
  if (!isUuid(submissionId)) return { status: "failed", message: "Unknown submission." };

  try {
    const provider = resendProviderFromEnv();

    const outcome = await queryAsStaff(async (tx): Promise<DecisionEmailResult> => {
      const [row] = await tx
        .select({
          status: submissions.status,
          userId: submissions.userId,
          email: profiles.email,
          fullName: profiles.fullName,
          formTitle: forms.title,
          formSlug: forms.slug,
        })
        .from(submissions)
        .innerJoin(profiles, eq(profiles.id, submissions.userId))
        .innerJoin(forms, eq(forms.id, submissions.formId))
        .where(eq(submissions.id, submissionId))
        .limit(1);
      if (!row) return { status: "failed", message: "Unknown submission." };

      if (!isDecisionStatus(row.status)) {
        return { status: "failed", message: "There is no decision on this application to send." };
      }

      const key =
        row.status === "accepted"
          ? "decision_accepted"
          : row.status === "waitlisted"
            ? "decision_waitlisted"
            : "decision_rejected";

      const [stored] = await tx
        .select({
          subject: emailTemplates.subject,
          bodyHtml: emailTemplates.bodyHtml,
          bodyText: emailTemplates.bodyText,
        })
        .from(emailTemplates)
        .where(eq(emailTemplates.key, key))
        .limit(1);
      if (!stored) return { status: "failed", message: `Template ${key} is not in the database.` };

      const base = {
        full_name: row.fullName ?? row.email,
        form_title: row.formTitle,
        year: String(new Date().getUTCFullYear()),
      };
      const to = row.email;
      const toUserId = row.userId;

      // Split on the one key that declares `rsvp_url`. Handing a template a
      // variable it does not declare is exactly what `renderTemplate` refuses,
      // so the two shapes stay two calls rather than one cast.
      const result =
        key === "decision_accepted"
          ? await sendTemplateEmail({
              tx,
              provider,
              template: { key, ...stored },
              context: { ...base, rsvp_url: rsvpUrl(row.formSlug) },
              to,
              toUserId,
            })
          : await sendTemplateEmail({
              tx,
              provider,
              template: { key, ...stored },
              context: base,
              to,
              toUserId,
            });

      return result.status === "sent"
        ? { status: "sent", to }
        : { status: "failed", message: result.error };
    });

    // Revalidated either way: a failed attempt is still a row in `email_sends`,
    // and the page reads it back, so the failure outlives the toast.
    revalidatePath(`/submissions/${submissionId}`);
    return outcome;
  } catch (cause) {
    return { status: "failed", message: reason(cause) };
  }
}
