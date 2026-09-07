import { sql } from "drizzle-orm";
import { index, jsonb, pgPolicy, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { revisionReason, rsvpStatus, submissionStatus } from "./enums.ts";
import { forms, questions } from "./forms.ts";
import { profiles } from "./identity.ts";
import { isAdmin, isOrganizer } from "./predicates.ts";

/**
 * The whole "which questions can be re-answered" feature, expressed once. Used
 * by the insert, update and delete policies on `answers` so a UI bug cannot
 * widen it.
 */
const answerWritable = () => sql`exists (
    select 1
    from submissions s
    join questions q on q.id = answers.question_id
    join forms f     on f.id = s.form_id
    where s.id = answers.submission_id
      and s.user_id = (select auth.uid())
      and (
        s.status = 'draft'
        or f.edit_policy = 'full'
        or (f.edit_policy = 'per_question' and q.editable_after_submit)
      )
  )`;

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: submissionStatus("status").default("draft").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => profiles.id, { onDelete: "set null" }),
    rsvpStatus: rsvpStatus("rsvp_status"),
    rsvpAt: timestamp("rsvp_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("submissions_form_id_user_id_unique").on(t.formId, t.userId),
    index("submissions_form_id_status_idx").on(t.formId, t.status),
    index("submissions_user_id_idx").on(t.userId),

    pgPolicy("submissions_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`user_id = (select auth.uid())`,
    }),
    pgPolicy("submissions_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`user_id = (select auth.uid())`,
    }),
    pgPolicy("submissions_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`user_id = (select auth.uid())`,
      withCheck: sql`user_id = (select auth.uid())`,
    }),
    pgPolicy("submissions_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
    // Decisions and RSVP state. RLS is row-level only; restricting *which*
    // columns an admin may set is a column grant, not a policy.
    pgPolicy("submissions_update_admin", {
      for: "update",
      to: authenticatedRole,
      using: isAdmin(),
      withCheck: isAdmin(),
    }),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("answers_submission_id_question_id_unique").on(t.submissionId, t.questionId),
    index("answers_question_id_submission_id_idx").on(t.questionId, t.submissionId),

    pgPolicy("answers_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (
    select 1 from submissions s
    where s.id = answers.submission_id and s.user_id = (select auth.uid())
  )`,
    }),
    pgPolicy("answers_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: answerWritable(),
    }),
    pgPolicy("answers_update_own", {
      for: "update",
      to: authenticatedRole,
      using: answerWritable(),
    }),
    // Branch discard deletes answers on the abandoned path; the delete trigger
    // preserves them in answer_revisions.
    pgPolicy("answers_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: answerWritable(),
    }),
    pgPolicy("answers_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
    // Deleting a question from a live form has to delete the answers to it
    // first: `answers.question_id` has no cascade, so the question delete would
    // otherwise fail on the foreign key. The applicant policies above are
    // scoped to the caller's own submission, so without this an admin's delete
    // matches no rows and the failure looks like a database bug rather than a
    // missing policy. The delete trigger still preserves every value in
    // `answer_revisions`.
    pgPolicy("answers_delete_admin", {
      for: "delete",
      to: authenticatedRole,
      using: isAdmin(),
    }),
  ],
);

/**
 * Append-only, written by trigger on update and delete of `answers`.
 *
 * `submission_id` and `question_id` are deliberately plain columns, not foreign
 * keys to `answers`: a branch discard deletes the answer row and the revision
 * has to outlive it.
 */
export const answerRevisions = pgTable(
  "answer_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    submissionId: uuid("submission_id").notNull(),
    questionId: uuid("question_id").notNull(),
    prevValue: jsonb("prev_value"),
    reason: revisionReason("reason").notNull(),
    editedBy: uuid("edited_by").references(() => profiles.id, { onDelete: "set null" }),
    editedAt: timestamp("edited_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("answer_revisions_submission_id_question_id_idx").on(t.submissionId, t.questionId),

    pgPolicy("answer_revisions_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
  ],
);

/** Free-for-all review: notes only, no score, no claim state. */
export const submissionReviews = pgTable(
  "submission_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    notes: text("notes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // One note per reviewer per submission, so "edit my note" is an upsert
    // rather than a select-then-write that two tabs can both win.
    unique("submission_reviews_submission_id_reviewer_id_unique").on(t.submissionId, t.reviewerId),
    index("submission_reviews_submission_id_idx").on(t.submissionId),

    pgPolicy("submission_reviews_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
    pgPolicy("submission_reviews_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`reviewer_id = (select auth.uid()) and public.is_organizer((select auth.uid()))`,
    }),
    pgPolicy("submission_reviews_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`reviewer_id = (select auth.uid()) and public.is_organizer((select auth.uid()))`,
      withCheck: sql`reviewer_id = (select auth.uid()) and public.is_organizer((select auth.uid()))`,
    }),
    pgPolicy("submission_reviews_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`reviewer_id = (select auth.uid()) and public.is_organizer((select auth.uid()))`,
    }),
  ],
);
