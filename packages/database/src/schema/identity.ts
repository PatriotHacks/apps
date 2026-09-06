import { sql } from "drizzle-orm";
import { foreignKey, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "drizzle-orm/supabase";

import { adminRole } from "./enums.ts";
import { isAdmin, isOrganizer } from "./predicates.ts";

/**
 * One row per human. Created by the `handle_new_user` trigger on `auth.users`,
 * never by application code.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().notNull(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.id],
      foreignColumns: [authUsers.id],
      name: "profiles_id_auth_users_id_fk",
    }).onDelete("cascade"),

    pgPolicy("profiles_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`id = (select auth.uid())`,
    }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`id = (select auth.uid())`,
      withCheck: sql`id = (select auth.uid())`,
    }),
    pgPolicy("profiles_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
  ],
);

/**
 * Presence in this table grants console access. `role` distinguishes what the
 * console lets you do once you are in.
 */
export const admins = pgTable(
  "admins",
  {
    userId: uuid("user_id")
      .primaryKey()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: adminRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  () => [
    // Lets a signed-in user discover their own role without exposing the roster.
    pgPolicy("admins_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`user_id = (select auth.uid())`,
    }),
    pgPolicy("admins_all_admin", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin(),
      withCheck: isAdmin(),
    }),
  ],
);
