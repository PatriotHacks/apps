CREATE TYPE "public"."admin_role" AS ENUM('admin', 'organizer');--> statement-breakpoint
CREATE TYPE "public"."branch_action" AS ENUM('next', 'section', 'submit');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'failed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."form_edit_policy" AS ENUM('locked', 'per_question', 'full');--> statement-breakpoint
CREATE TYPE "public"."form_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "public"."form_visibility" AS ENUM('public', 'role', 'gated');--> statement-breakpoint
CREATE TYPE "public"."option_kind" AS ENUM('choice', 'grid_row', 'grid_column');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('short_answer', 'paragraph', 'multiple_choice', 'checkboxes', 'dropdown', 'linear_scale', 'date', 'time', 'grid_multiple_choice', 'grid_checkbox', 'file_upload');--> statement-breakpoint
CREATE TYPE "public"."revision_reason" AS ENUM('edit', 'branch_discarded');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('pending', 'confirmed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'submitted', 'under_review', 'accepted', 'waitlisted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text NOT NULL,
	"audience_filter" jsonb,
	"status" "broadcast_status" DEFAULT 'draft' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text,
	"broadcast_id" uuid,
	"to_user_id" uuid,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"provider_message_id" text,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "email_sends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_unsubscribes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"unsubscribed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_unsubscribes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "form_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"title" text,
	"description" text,
	"position" integer NOT NULL,
	"next_action" "branch_action" DEFAULT 'next' NOT NULL,
	"next_section_id" uuid,
	CONSTRAINT "form_sections_form_id_position_unique" UNIQUE("form_id","position")
);
--> statement-breakpoint
ALTER TABLE "form_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "form_status" DEFAULT 'draft' NOT NULL,
	"visibility" "form_visibility" DEFAULT 'public' NOT NULL,
	"edit_policy" "form_edit_policy" DEFAULT 'locked' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "forms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"kind" "option_kind" NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"position" integer NOT NULL,
	"next_action" "branch_action" DEFAULT 'next' NOT NULL,
	"next_section_id" uuid,
	CONSTRAINT "question_options_question_id_kind_position_unique" UNIQUE("question_id","kind","position")
);
--> statement-breakpoint
ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"type" "question_type" NOT NULL,
	"label" text NOT NULL,
	"help_text" text,
	"position" integer NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"editable_after_submit" boolean DEFAULT false NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_section_id_position_unique" UNIQUE("section_id","position")
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "admin_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "answer_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"prev_value" jsonb,
	"reason" "revision_reason" NOT NULL,
	"edited_by" uuid,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_submission_id_question_id_unique" UNIQUE("submission_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "submission_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"notes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "submission_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"rsvp_status" "rsvp_status",
	"rsvp_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_form_id_user_id_unique" UNIQUE("form_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_to_user_id_profiles_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_unsubscribes" ADD CONSTRAINT "email_unsubscribes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sections" ADD CONSTRAINT "form_sections_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sections" ADD CONSTRAINT "form_sections_next_section_id_fk" FOREIGN KEY ("next_section_id") REFERENCES "public"."form_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_next_section_id_form_sections_id_fk" FOREIGN KEY ("next_section_id") REFERENCES "public"."form_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_section_id_form_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."form_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_auth_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_revisions" ADD CONSTRAINT "answer_revisions_edited_by_profiles_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_sends_to_user_id_created_at_idx" ON "email_sends" USING btree ("to_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forms_slug_active_idx" ON "forms" USING btree ("slug") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "answer_revisions_submission_id_question_id_idx" ON "answer_revisions" USING btree ("submission_id","question_id");--> statement-breakpoint
CREATE INDEX "answers_question_id_submission_id_idx" ON "answers" USING btree ("question_id","submission_id");--> statement-breakpoint
CREATE INDEX "submission_reviews_submission_id_idx" ON "submission_reviews" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submissions_form_id_status_idx" ON "submissions" USING btree ("form_id","status");--> statement-breakpoint
CREATE INDEX "submissions_user_id_idx" ON "submissions" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "broadcasts_all_admin" ON "broadcasts" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "email_sends_all_admin" ON "email_sends" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "email_templates_all_admin" ON "email_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "email_unsubscribes_all_admin" ON "email_unsubscribes" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "form_sections_select_published" ON "form_sections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.forms f where f.id = form_id and f.status = 'published' and f.deleted_at is null));--> statement-breakpoint
CREATE POLICY "form_sections_select_staff" ON "form_sections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "form_sections_all_admin" ON "form_sections" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "forms_select_published" ON "forms" AS PERMISSIVE FOR SELECT TO "authenticated" USING (status = 'published' and deleted_at is null);--> statement-breakpoint
CREATE POLICY "forms_select_staff" ON "forms" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "forms_all_admin" ON "forms" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "question_options_select_published" ON "question_options" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
    select 1
    from public.questions q
    join public.forms f on f.id = q.form_id
    where q.id = question_id
      and f.status = 'published'
      and f.deleted_at is null
  ));--> statement-breakpoint
CREATE POLICY "question_options_select_staff" ON "question_options" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "question_options_all_admin" ON "question_options" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "questions_select_published" ON "questions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.forms f where f.id = form_id and f.status = 'published' and f.deleted_at is null));--> statement-breakpoint
CREATE POLICY "questions_select_staff" ON "questions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "questions_all_admin" ON "questions" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "admins_select_own" ON "admins" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "admins_all_admin" ON "admins" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_select_staff" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "answer_revisions_select_staff" ON "answer_revisions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "answers_select_own" ON "answers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
    select 1 from submissions s
    where s.id = answers.submission_id and s.user_id = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "answers_insert_own" ON "answers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
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
  ));--> statement-breakpoint
CREATE POLICY "answers_update_own" ON "answers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
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
  ));--> statement-breakpoint
CREATE POLICY "answers_delete_own" ON "answers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
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
  ));--> statement-breakpoint
CREATE POLICY "answers_select_staff" ON "answers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "submission_reviews_select_staff" ON "submission_reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "submission_reviews_insert_own" ON "submission_reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (reviewer_id = (select auth.uid()) and public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "submission_reviews_update_own" ON "submission_reviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (reviewer_id = (select auth.uid()) and public.is_organizer((select auth.uid()))) WITH CHECK (reviewer_id = (select auth.uid()) and public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "submission_reviews_delete_own" ON "submission_reviews" AS PERMISSIVE FOR DELETE TO "authenticated" USING (reviewer_id = (select auth.uid()) and public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "submissions_select_own" ON "submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "submissions_insert_own" ON "submissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "submissions_update_own" ON "submissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "submissions_select_staff" ON "submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_organizer((select auth.uid())));--> statement-breakpoint
CREATE POLICY "submissions_update_admin" ON "submissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));