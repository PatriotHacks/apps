import { sql } from "drizzle-orm";
import { boolean, check, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole } from "drizzle-orm/supabase";

import { isAdmin } from "./predicates.ts";

/**
 * Volunteer and judge applications from the public website, which submits them
 * with the anon key. Anon may INSERT and nothing else, and only admins read them
 * in the console; the grants that make that true are revoked and re-granted by
 * hand in the migration. A repeat email fails the `lower(email)` unique index
 * with 23505, which the form reports as already applied.
 */
export const volunteers = pgTable(
  "volunteers",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    isGmuAlum: boolean("is_gmu_alum").notNull(),
    reason: text("reason").notNull(),
    ackTransportation: boolean("ack_transportation").notNull(),
    ackCommitment: boolean("ack_commitment").notNull(),
    ackCodeOfConduct: boolean("ack_code_of_conduct").notNull(),
    ackContact: boolean("ack_contact").notNull(),
  },
  (t) => [
    uniqueIndex("volunteers_email_unique").on(sql`lower(${t.email})`),
    check("volunteers_name_check", sql`char_length(name) between 1 and 120`),
    check("volunteers_email_check", sql`char_length(email) between 3 and 254`),
    check("volunteers_reason_check", sql`char_length(reason) between 1 and 2000`),
    check("volunteers_ack_transportation_check", sql`ack_transportation`),
    check("volunteers_ack_commitment_check", sql`ack_commitment`),
    check("volunteers_ack_code_of_conduct_check", sql`ack_code_of_conduct`),
    check("volunteers_ack_contact_check", sql`ack_contact`),
    pgPolicy("Anyone can submit a volunteer application", {
      for: "insert",
      to: anonRole,
      withCheck: sql`true`,
    }),
    pgPolicy("volunteers_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: isAdmin(),
    }),
  ],
);

export const judges = pgTable(
  "judges",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    isGmuAlum: boolean("is_gmu_alum").notNull(),
    company: text("company").notNull(),
    jobTitle: text("job_title").notNull(),
    expertise: text("expertise").notNull(),
    reason: text("reason").notNull(),
    ackTransportation: boolean("ack_transportation").notNull(),
    ackCommitment: boolean("ack_commitment").notNull(),
    ackCodeOfConduct: boolean("ack_code_of_conduct").notNull(),
    ackContact: boolean("ack_contact").notNull(),
  },
  (t) => [
    uniqueIndex("judges_email_unique").on(sql`lower(${t.email})`),
    check("judges_name_check", sql`char_length(name) between 1 and 120`),
    check("judges_email_check", sql`char_length(email) between 3 and 254`),
    check("judges_company_check", sql`char_length(company) between 1 and 160`),
    check("judges_job_title_check", sql`char_length(job_title) between 1 and 160`),
    check("judges_expertise_check", sql`char_length(expertise) between 1 and 300`),
    check("judges_reason_check", sql`char_length(reason) between 1 and 2000`),
    check("judges_ack_transportation_check", sql`ack_transportation`),
    check("judges_ack_commitment_check", sql`ack_commitment`),
    check("judges_ack_code_of_conduct_check", sql`ack_code_of_conduct`),
    check("judges_ack_contact_check", sql`ack_contact`),
    pgPolicy("Anyone can submit a judge application", {
      for: "insert",
      to: anonRole,
      withCheck: sql`true`,
    }),
    pgPolicy("judges_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: isAdmin(),
    }),
  ],
);
