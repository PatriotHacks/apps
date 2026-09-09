-- Custom email templates live in `email_templates` beside the four the code
-- declares, so the console has one list and one editor entry point.
--
-- Which rows are which is code, not SQL: a key in `TEMPLATE_KEYS` is built in
-- and anything else is an admin's own. The database cannot read that catalogue,
-- so it enforces only the pairing — a built-in is raw HTML with no label, a
-- custom template has both a label and blocks.
--
-- `created_at` is what orders the custom ones. `updated_at` already exists and
-- moves on every save, which is no order at all for a list of designs.
ALTER TABLE "email_templates" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "blocks" jsonb;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_custom_pair" CHECK ((name is null) = (blocks is null));
