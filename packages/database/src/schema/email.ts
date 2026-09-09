import { sql } from "drizzle-orm";
import {
  check,
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

import { broadcastStatus, emailStatus } from "./enums.ts";
import { profiles } from "./identity.ts";
import { isAdmin } from "./predicates.ts";

/**
 * Every email table is admin-only. Applicants never read or write them; the
 * unsubscribe link is handled server-side through the service-role client.
 */
const adminOnly = (name: string) =>
  pgPolicy(name, {
    for: "all",
    to: authenticatedRole,
    using: isAdmin(),
    withCheck: isAdmin(),
  });

/**
 * One table for both kinds of template. A key the code catalogue declares is
 * built in: raw HTML an organizer edits, with the variables its send site can
 * supply. Anything else is a template an admin built from blocks, and carries a
 * label and a `blocks` array instead.
 *
 * SQL cannot know that catalogue, so it enforces only the pairing: both `name`
 * and `blocks` or neither. `blocks` itself is validated by the zod schema in
 * `@patriothacks/emails` on the way in and on the way out, the same as
 * `newsletters.blocks`.
 */
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    key: text("key").notNull(),
    /** The admin's label. Null for a built-in, whose label lives in code. */
    name: text("name"),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull(),
    /** Null for a built-in, which stays raw HTML. */
    blocks: jsonb("blocks"),
    updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("email_templates_key_unique").on(t.key),
    check("email_templates_custom_pair", sql`(name is null) = (blocks is null)`),
    adminOnly("email_templates_all_admin"),
  ],
);

export const broadcasts = pgTable(
  "broadcasts",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull(),
    audienceFilter: jsonb("audience_filter"),
    status: broadcastStatus("status").default("draft").notNull(),
    recipientCount: integer("recipient_count").default(0).notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  () => [adminOnly("broadcasts_all_admin")],
);

export const emailSends = pgTable(
  "email_sends",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    templateKey: text("template_key"),
    broadcastId: uuid("broadcast_id").references(() => broadcasts.id, { onDelete: "set null" }),
    toUserId: uuid("to_user_id").references(() => profiles.id, { onDelete: "set null" }),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    providerMessageId: text("provider_message_id"),
    status: emailStatus("status").default("queued").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    index("email_sends_to_user_id_created_at_idx").on(t.toUserId, t.createdAt.desc()),
    adminOnly("email_sends_all_admin"),
  ],
);

/**
 * A newsletter is a design, not a send: an ordered list of typed blocks that a
 * broadcast compiles into its own body. Nothing here mails anybody, which is
 * why there is no status, no audience and no `sent_at`.
 *
 * `blocks` is validated by the zod schema in `@patriothacks/emails` on the way
 * in and on the way out, so the shape of the jsonb is code rather than a
 * database constraint.
 */
export const newsletters = pgTable(
  "newsletters",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    name: text("name").notNull(),
    blocks: jsonb("blocks").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  () => [adminOnly("newsletters_all_admin")],
);

/** Consulted for broadcasts only. Transactional decision and RSVP mail ignores it. */
export const emailUnsubscribes = pgTable(
  "email_unsubscribes",
  {
    userId: uuid("user_id")
      .primaryKey()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  () => [adminOnly("email_unsubscribes_all_admin")],
);
