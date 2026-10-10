-- Volunteer and judge applications move here from the website's own Supabase
-- project. The site submits them with the anon key, so anon may INSERT and do
-- nothing else.
--
-- The policies alone are not enough: Supabase's default privileges on `public`
-- grant `anon` and `authenticated` every table privilege, and a policy removes
-- none of them. Revoke everything, then grant back only INSERT. With no SELECT
-- grant a repeat email still trips the `lower(email)` unique index (23505) without
-- the site ever reading the table. The console reads both tables through the
-- service-role connection.
CREATE TABLE "judges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"is_gmu_alum" boolean NOT NULL,
	"company" text NOT NULL,
	"job_title" text NOT NULL,
	"expertise" text NOT NULL,
	"reason" text NOT NULL,
	"ack_transportation" boolean NOT NULL,
	"ack_commitment" boolean NOT NULL,
	"ack_code_of_conduct" boolean NOT NULL,
	"ack_contact" boolean NOT NULL,
	CONSTRAINT "judges_name_check" CHECK (char_length(name) between 1 and 120),
	CONSTRAINT "judges_email_check" CHECK (char_length(email) between 3 and 254),
	CONSTRAINT "judges_company_check" CHECK (char_length(company) between 1 and 160),
	CONSTRAINT "judges_job_title_check" CHECK (char_length(job_title) between 1 and 160),
	CONSTRAINT "judges_expertise_check" CHECK (char_length(expertise) between 1 and 300),
	CONSTRAINT "judges_reason_check" CHECK (char_length(reason) between 1 and 2000),
	CONSTRAINT "judges_ack_transportation_check" CHECK (ack_transportation),
	CONSTRAINT "judges_ack_commitment_check" CHECK (ack_commitment),
	CONSTRAINT "judges_ack_code_of_conduct_check" CHECK (ack_code_of_conduct),
	CONSTRAINT "judges_ack_contact_check" CHECK (ack_contact)
);--> statement-breakpoint
ALTER TABLE "judges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"is_gmu_alum" boolean NOT NULL,
	"reason" text NOT NULL,
	"ack_transportation" boolean NOT NULL,
	"ack_commitment" boolean NOT NULL,
	"ack_code_of_conduct" boolean NOT NULL,
	"ack_contact" boolean NOT NULL,
	CONSTRAINT "volunteers_name_check" CHECK (char_length(name) between 1 and 120),
	CONSTRAINT "volunteers_email_check" CHECK (char_length(email) between 3 and 254),
	CONSTRAINT "volunteers_reason_check" CHECK (char_length(reason) between 1 and 2000),
	CONSTRAINT "volunteers_ack_transportation_check" CHECK (ack_transportation),
	CONSTRAINT "volunteers_ack_commitment_check" CHECK (ack_commitment),
	CONSTRAINT "volunteers_ack_code_of_conduct_check" CHECK (ack_code_of_conduct),
	CONSTRAINT "volunteers_ack_contact_check" CHECK (ack_contact)
);--> statement-breakpoint
ALTER TABLE "volunteers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "judges_email_unique" ON "judges" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "volunteers_email_unique" ON "volunteers" USING btree (lower("email"));--> statement-breakpoint
CREATE POLICY "Anyone can submit a judge application" ON "judges" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Anyone can submit a volunteer application" ON "volunteers" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (true);--> statement-breakpoint
REVOKE ALL ON "volunteers" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "judges" FROM anon, authenticated;--> statement-breakpoint
GRANT INSERT ON "volunteers" TO anon;--> statement-breakpoint
GRANT INSERT ON "judges" TO anon;
