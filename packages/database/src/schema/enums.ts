import { pgEnum } from "drizzle-orm/pg-core";

export const adminRole = pgEnum("admin_role", ["admin", "organizer"]);

export const formStatus = pgEnum("form_status", ["draft", "published", "closed"]);

export const formVisibility = pgEnum("form_visibility", ["public", "role", "gated"]);

export const formEditPolicy = pgEnum("form_edit_policy", ["locked", "per_question", "full"]);

/**
 * The 11 supported question types. `packages/form-engine` registers one entry per
 * value; the two lists must stay identical.
 */
export const questionType = pgEnum("question_type", [
  "short_answer",
  "paragraph",
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "linear_scale",
  "date",
  "time",
  "grid_multiple_choice",
  "grid_checkbox",
  "file_upload",
]);

export const optionKind = pgEnum("option_kind", ["choice", "grid_row", "grid_column"]);

export const branchAction = pgEnum("branch_action", ["next", "section", "submit"]);

export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "waitlisted",
  "rejected",
  "withdrawn",
]);

export const rsvpStatus = pgEnum("rsvp_status", ["pending", "confirmed", "declined"]);

export const revisionReason = pgEnum("revision_reason", ["edit", "branch_discarded"]);

export const emailStatus = pgEnum("email_status", ["queued", "sent", "failed", "bounced"]);

export const broadcastStatus = pgEnum("broadcast_status", ["draft", "sending", "sent", "failed"]);
