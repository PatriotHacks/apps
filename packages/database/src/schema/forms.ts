import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { branchAction, formEditPolicy, formStatus, formVisibility, optionKind, questionType } from "./enums.ts";
import { profiles } from "./identity.ts";
import { isAdmin, isOrganizer } from "./predicates.ts";

/** Read the parent form only if it is published and not soft-deleted. */
const parentFormPublished = (column: string) =>
  sql.raw(
    `exists (select 1 from public.forms f where f.id = ${column} and f.status = 'published' and f.deleted_at is null)`,
  );

export const forms = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: formStatus("status").default("draft").notNull(),
    visibility: formVisibility("visibility").default("public").notNull(),
    editPolicy: formEditPolicy("edit_policy").default("locked").notNull(),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("forms_slug_unique").on(t.slug),
    index("forms_slug_active_idx").on(t.slug).where(sql`deleted_at is null`),

    pgPolicy("forms_select_published", {
      for: "select",
      to: authenticatedRole,
      using: sql`status = 'published' and deleted_at is null`,
    }),
    pgPolicy("forms_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
    pgPolicy("forms_all_admin", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin(),
      withCheck: isAdmin(),
    }),
  ],
);

export const formSections = pgTable(
  "form_sections",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    title: text("title"),
    description: text("description"),
    position: integer("position").notNull(),
    nextAction: branchAction("next_action").default("next").notNull(),
    nextSectionId: uuid("next_section_id"),
  },
  (t) => [
    unique("form_sections_form_id_position_unique").on(t.formId, t.position),
    foreignKey({
      columns: [t.nextSectionId],
      foreignColumns: [t.id],
      name: "form_sections_next_section_id_fk",
    }).onDelete("set null"),

    pgPolicy("form_sections_select_published", {
      for: "select",
      to: authenticatedRole,
      using: parentFormPublished("form_id"),
    }),
    pgPolicy("form_sections_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
    pgPolicy("form_sections_all_admin", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin(),
      withCheck: isAdmin(),
    }),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => formSections.id, { onDelete: "cascade" }),
    // Denormalized from form_sections so RLS and the response grid can filter by
    // form without a join.
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    type: questionType("type").notNull(),
    label: text("label").notNull(),
    helpText: text("help_text"),
    position: integer("position").notNull(),
    required: boolean("required").default(false).notNull(),
    editableAfterSubmit: boolean("editable_after_submit").default(false).notNull(),
    config: jsonb("config"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("questions_section_id_position_unique").on(t.sectionId, t.position),

    pgPolicy("questions_select_published", {
      for: "select",
      to: authenticatedRole,
      using: parentFormPublished("form_id"),
    }),
    pgPolicy("questions_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
    pgPolicy("questions_all_admin", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin(),
      withCheck: isAdmin(),
    }),
  ],
);

/**
 * One table, three roles, selected by `kind`: `choice` for multiple choice,
 * checkboxes and dropdown; `grid_row` and `grid_column` for the two axes of a
 * grid question. Per-option `next_section_id` is where branching lives.
 */
export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    kind: optionKind("kind").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    position: integer("position").notNull(),
    nextAction: branchAction("next_action").default("next").notNull(),
    nextSectionId: uuid("next_section_id").references(() => formSections.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    unique("question_options_question_id_kind_position_unique").on(t.questionId, t.kind, t.position),

    pgPolicy("question_options_select_published", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (
    select 1
    from public.questions q
    join public.forms f on f.id = q.form_id
    where q.id = question_id
      and f.status = 'published'
      and f.deleted_at is null
  )`,
    }),
    pgPolicy("question_options_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
    pgPolicy("question_options_all_admin", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin(),
      withCheck: isAdmin(),
    }),
  ],
);
