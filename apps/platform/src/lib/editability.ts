import type { Form, Submission } from "@patriothacks/database";
import type { Question } from "@patriothacks/form-engine";

/**
 * The client-side mirror of the `answers_update_own` policy and the
 * `opens_at`/`closes_at` window. Postgres is the boundary; this exists so the
 * UI can grey out what the database would refuse rather than accepting typing
 * it is about to throw away.
 */

export type WindowState = "before" | "open" | "after";

export function windowState(form: Form, now: Date = new Date()): WindowState {
  if (form.opensAt !== null && now < form.opensAt) return "before";
  if (form.closesAt !== null && now > form.closesAt) return "after";
  return "open";
}

export function windowExplanation(form: Form, state: WindowState): string | null {
  if (state === "before") {
    return form.opensAt === null
      ? "This form is not open yet."
      : `This form opens on ${formatDate(form.opensAt)}.`;
  }
  if (state === "after") {
    return form.closesAt === null
      ? "This form is closed."
      : `This form closed on ${formatDate(form.closesAt)}.`;
  }
  return null;
}

/** Same three clauses as the policy: draft, `full`, or a flagged question. */
export function canEditQuestion(
  editPolicy: Form["editPolicy"],
  question: Question,
  status: Submission["status"] | null,
): boolean {
  if (status === null || status === "draft") return true;
  if (editPolicy === "full") return true;
  return editPolicy === "per_question" && question.editableAfterSubmit;
}

/** Stored UTC, rendered in the event's timezone. */
export function formatDate(value: Date): string {
  return value.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export const SUBMISSION_STATUS_LABELS: Record<Submission["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};
