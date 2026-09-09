-- Design materials: the table, and the private bucket the files live in.
--
-- No GRANT statements, exactly as in 0001_schema.sql: Supabase's default
-- privileges on `public` already give `anon`, `authenticated` and `service_role`
-- table privileges on anything `postgres` creates here, and RLS is what decides
-- who gets rows. Adding grants would only restate them.
CREATE TABLE "design_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"link_url" text,
	"storage_path" text,
	"file_name" text,
	"mime_type" text,
	"size_bytes" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_assets_not_empty" CHECK (link_url is not null or storage_path is not null)
);
--> statement-breakpoint
ALTER TABLE "design_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "design_assets" ADD CONSTRAINT "design_assets_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "design_assets_select_staff" ON "design_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "design_assets_insert_admin" ON "design_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "design_assets_update_admin" ON "design_assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "design_assets_delete_admin" ON "design_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin((select auth.uid())));--> statement-breakpoint
-- The bucket. Private, and its own limits are the ones that actually hold: the
-- browser uploads straight to storage, so `file_size_limit` and
-- `allowed_mime_types` here are the enforcement, not the `accept` attribute.
-- `supabase/config.toml` declares the same bucket for the local stack, and
-- `apps/admin/src/lib/design-files.ts` carries the same two rules for the UI --
-- neither can read this file, so all three move together.
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES (
	'designs',
	'designs',
	false,
	26214400,
	ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf', 'application/zip']
)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
-- Object policies, scoped to this bucket alone so they say nothing about the
-- submissions bucket. Same split as the table: any console user may read, only
-- an admin may write, and an organizer's upload is refused by the database
-- rather than by the console hiding the control.
CREATE POLICY "designs_objects_select_staff" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (bucket_id = 'designs' AND public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "designs_objects_insert_admin" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (bucket_id = 'designs' AND public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "designs_objects_update_admin" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (bucket_id = 'designs' AND public.is_admin((select auth.uid()))) WITH CHECK (bucket_id = 'designs' AND public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "designs_objects_delete_admin" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (bucket_id = 'designs' AND public.is_admin((select auth.uid())));
