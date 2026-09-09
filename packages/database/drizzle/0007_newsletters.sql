-- A newsletter is a design, not a send: an ordered list of typed blocks that a
-- broadcast compiles into its own `body_html` and `body_text`. That is why this
-- table carries no status, no audience filter and no `sent_at` — the sending
-- side of the story already exists on `broadcasts`, and a design is reusable
-- across as many of them as an organizer likes.
--
-- `blocks` is jsonb rather than a table per block type. The shape is owned by
-- the zod schema in `@patriothacks/emails`, which every read and every write
-- passes through, so a hand-edited row fails at the loader instead of reaching
-- the builder as garbage.
--
-- Admin-only, like every other email table. No explicit grants: `0001_schema.sql`
-- issues none either, because Supabase's default privileges on `public` already
-- cover `authenticated` and `anon`, and RLS is what actually decides.
CREATE TABLE "newsletters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "newsletters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "newsletters_all_admin" ON "newsletters" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));
