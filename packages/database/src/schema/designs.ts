import { sql } from "drizzle-orm";
import { check, integer, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { profiles } from "./identity.ts";
import { isAdmin, isOrganizer } from "./predicates.ts";

/**
 * Design materials in one shared place: an uploaded file, a link to wherever the
 * design actually lives, or both.
 *
 * Reads are open to every console user deliberately — materials an organizer
 * cannot see defeat the point of one shared place — while every write is
 * admin-only. The storage columns and `link_url` are all nullable because an
 * entry may be either kind, so the check constraint is what stops an entry that
 * is neither.
 */
export const designAssets = pgTable(
  "design_assets",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    title: text("title").notNull(),
    description: text("description"),
    linkUrl: text("link_url"),
    /** `{asset_id}/{file_name}` in the `designs` bucket. */
    storagePath: text("storage_path"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  () => [
    check("design_assets_not_empty", sql`link_url is not null or storage_path is not null`),

    pgPolicy("design_assets_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer(),
    }),
    pgPolicy("design_assets_insert_admin", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isAdmin(),
    }),
    pgPolicy("design_assets_update_admin", {
      for: "update",
      to: authenticatedRole,
      using: isAdmin(),
      withCheck: isAdmin(),
    }),
    pgPolicy("design_assets_delete_admin", {
      for: "delete",
      to: authenticatedRole,
      using: isAdmin(),
    }),
  ],
);
