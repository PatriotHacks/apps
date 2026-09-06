import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import {
  admins,
  emailTemplates,
  formSections,
  forms,
  questionOptions,
  questions,
} from "./schema/index.ts";
import type { NewQuestion, NewQuestionOption } from "./types.ts";

/**
 * Makes a fresh clone usable straight after `pnpm db:reset`: two console users
 * and one published, branching form that exercises all 11 question types.
 *
 * Local development only. Every id is fixed so re-running is a no-op.
 */

const SEED_PASSWORD = "password123";

const USERS = [
  { id: "00000000-0000-0000-0000-0000000000a1", email: "admin@patriothacks.org", fullName: "Ada Admin" },
  { id: "00000000-0000-0000-0000-0000000000b1", email: "organizer@patriothacks.org", fullName: "Otto Organizer" },
] as const;

const [ADMIN, ORGANIZER] = USERS;

const FORM_ID = "11111111-1111-1111-1111-111111111111";

const section = (n: number) => `22222222-2222-2222-2222-${String(n).padStart(12, "0")}`;
const question = (n: number) => `33333333-3333-3333-3333-${String(n).padStart(12, "0")}`;
const option = (n: number) => `44444444-4444-4444-4444-${String(n).padStart(12, "0")}`;

const ABOUT = section(1);
const EXPERIENCE = section(2);
const FIRST_TIME = section(3);
const RETURNING = section(4);
const LOGISTICS = section(5);

type SeedDb = NodePgDatabase;

async function seedAuthUsers(db: SeedDb) {
  for (const user of USERS) {
    // The handle_new_user trigger creates the matching profiles row.
    await db.execute(sql`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', ${user.id}, 'authenticated', 'authenticated',
        ${user.email}, extensions.crypt(${SEED_PASSWORD}, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', ${user.fullName}::text),
        now(), now(), '', '', '', ''
      )
      on conflict do nothing
    `);

    await db.execute(sql`
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), ${user.id}, ${user.id},
        jsonb_build_object('sub', ${user.id}::text, 'email', ${user.email}::text),
        'email', now(), now(), now()
      )
      on conflict do nothing
    `);
  }

  await db
    .insert(admins)
    .values([
      { userId: ADMIN.id, role: "admin", createdBy: ADMIN.id },
      { userId: ORGANIZER.id, role: "organizer", createdBy: ADMIN.id },
    ])
    .onConflictDoNothing();
}

async function seedEmailTemplates(db: SeedDb) {
  const template = (key: string, subject: string, body: string) => ({
    key,
    subject,
    bodyHtml: `<p>${body}</p>`,
    bodyText: body,
    updatedBy: ADMIN.id,
  });

  await db
    .insert(emailTemplates)
    .values([
      template(
        "decision_accepted",
        "You're in — PatriotHacks {{year}}",
        "Hi {{full_name}}, your application to {{form_title}} was accepted. RSVP at {{rsvp_url}}.",
      ),
      template(
        "decision_waitlisted",
        "PatriotHacks {{year}} waitlist",
        "Hi {{full_name}}, you're on the waitlist for {{form_title}}. We'll email you if a spot opens.",
      ),
      template(
        "decision_rejected",
        "PatriotHacks {{year}} application update",
        "Hi {{full_name}}, we couldn't offer you a spot at {{form_title}} this time.",
      ),
      template(
        "rsvp_confirmed",
        "RSVP confirmed — PatriotHacks {{year}}",
        "Hi {{full_name}}, your spot at {{form_title}} is confirmed. See you there.",
      ),
    ])
    .onConflictDoNothing();
}

async function seedSampleForm(db: SeedDb) {
  const now = new Date();
  const closesAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  await db
    .insert(forms)
    .values({
      id: FORM_ID,
      slug: "hacker",
      title: "PatriotHacks Hacker Application",
      description: "Apply to attend PatriotHacks. Takes about ten minutes.",
      status: "published",
      visibility: "public",
      // Exercises questions.editable_after_submit rather than locking everything.
      editPolicy: "per_question",
      opensAt: now,
      closesAt,
      publishedAt: now,
      createdBy: ADMIN.id,
    })
    .onConflictDoNothing();

  // One statement, so the forward reference from "First hackathon" to
  // "Logistics" resolves when the FK triggers fire at end of statement.
  await db
    .insert(formSections)
    .values([
      { id: ABOUT, formId: FORM_ID, title: "About you", position: 0, nextAction: "next" },
      {
        id: EXPERIENCE,
        formId: FORM_ID,
        title: "Experience",
        description: "Your answer here decides which section comes next.",
        position: 1,
        nextAction: "next",
      },
      {
        id: FIRST_TIME,
        formId: FORM_ID,
        title: "First hackathon",
        position: 2,
        nextAction: "section",
        nextSectionId: LOGISTICS,
      },
      { id: RETURNING, formId: FORM_ID, title: "Welcome back", position: 3, nextAction: "next" },
      { id: LOGISTICS, formId: FORM_ID, title: "Logistics", position: 4, nextAction: "submit" },
    ])
    .onConflictDoNothing();

  const rows: NewQuestion[] = [
    {
      id: question(1),
      sectionId: ABOUT,
      formId: FORM_ID,
      type: "short_answer",
      label: "Full name",
      position: 0,
      required: true,
      config: { maxLength: 120 },
    },
    {
      id: question(2),
      sectionId: ABOUT,
      formId: FORM_ID,
      type: "dropdown",
      label: "School",
      position: 1,
      required: true,
    },
    {
      id: question(3),
      sectionId: ABOUT,
      formId: FORM_ID,
      type: "date",
      label: "Date of birth",
      position: 2,
      required: true,
    },
    {
      id: question(4),
      sectionId: ABOUT,
      formId: FORM_ID,
      type: "time",
      label: "When do you expect to arrive on Friday?",
      position: 3,
    },
    {
      id: question(5),
      sectionId: EXPERIENCE,
      formId: FORM_ID,
      type: "multiple_choice",
      label: "Have you been to a hackathon before?",
      helpText: "This decides which section you see next.",
      position: 0,
      required: true,
    },
    {
      id: question(6),
      sectionId: EXPERIENCE,
      formId: FORM_ID,
      type: "linear_scale",
      label: "How would you rate your coding experience?",
      position: 1,
      required: true,
      config: { min: 1, max: 5, minLabel: "Just starting", maxLabel: "Very confident" },
    },
    {
      id: question(7),
      sectionId: FIRST_TIME,
      formId: FORM_ID,
      type: "paragraph",
      label: "What do you hope to learn this weekend?",
      position: 0,
      required: true,
      editableAfterSubmit: true,
      config: { maxLength: 1500 },
    },
    {
      id: question(8),
      sectionId: RETURNING,
      formId: FORM_ID,
      type: "paragraph",
      label: "What did you build at your last hackathon?",
      position: 0,
      required: true,
      editableAfterSubmit: true,
      config: { maxLength: 1500 },
    },
    {
      id: question(9),
      sectionId: RETURNING,
      formId: FORM_ID,
      type: "file_upload",
      label: "Resume",
      helpText: "PDF, 10MB max.",
      position: 1,
      config: { allowedMimeTypes: ["application/pdf"], maxBytes: 10 * 1024 * 1024 },
    },
    {
      id: question(10),
      sectionId: LOGISTICS,
      formId: FORM_ID,
      type: "checkboxes",
      label: "Dietary restrictions",
      position: 0,
    },
    {
      id: question(11),
      sectionId: LOGISTICS,
      formId: FORM_ID,
      type: "grid_multiple_choice",
      label: "How interested are you in each track?",
      position: 1,
    },
    {
      id: question(12),
      sectionId: LOGISTICS,
      formId: FORM_ID,
      type: "grid_checkbox",
      label: "Which sessions can you attend?",
      position: 2,
    },
    {
      id: question(13),
      sectionId: LOGISTICS,
      formId: FORM_ID,
      type: "short_answer",
      label: "T-shirt size",
      position: 3,
      required: true,
      editableAfterSubmit: true,
    },
  ];

  await db.insert(questions).values(rows).onConflictDoNothing();

  let n = 0;
  const choices = (questionId: string, labels: string[]): NewQuestionOption[] =>
    labels.map((label, position) => ({
      id: option(++n),
      questionId,
      kind: "choice" as const,
      label,
      value: label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_"),
      position,
    }));

  const axis = (questionId: string, kind: "grid_row" | "grid_column", labels: string[]): NewQuestionOption[] =>
    labels.map((label, position) => ({
      id: option(++n),
      questionId,
      kind,
      label,
      value: label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_"),
      position,
    }));

  await db
    .insert(questionOptions)
    .values([
      ...choices(question(2), ["George Mason University", "Virginia Tech", "University of Virginia", "Other"]),

      // The branch. Each answer jumps to a different section, and both targets
      // sit at a higher position than this question's section, which is the
      // invariant that keeps the graph acyclic.
      {
        id: option(++n),
        questionId: question(5),
        kind: "choice",
        label: "No, this is my first",
        value: "first_time",
        position: 0,
        nextAction: "section",
        nextSectionId: FIRST_TIME,
      },
      {
        id: option(++n),
        questionId: question(5),
        kind: "choice",
        label: "Yes, I have",
        value: "returning",
        position: 1,
        nextAction: "section",
        nextSectionId: RETURNING,
      },

      ...choices(question(10), ["Vegetarian", "Vegan", "Halal", "Gluten free", "No restrictions"]),

      ...axis(question(11), "grid_row", ["Web", "Hardware", "AI and ML"]),
      ...axis(question(11), "grid_column", ["Not interested", "Curious", "Very interested"]),

      ...axis(question(12), "grid_row", ["Friday", "Saturday", "Sunday"]),
      ...axis(question(12), "grid_column", ["Morning", "Afternoon", "Evening"]),
    ])
    .onConflictDoNothing();
}

async function main() {
  const connectionString = process.env.DIRECT_DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_DATABASE_URL is not set");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  const db = drizzle(client);

  try {
    await seedAuthUsers(db);
    await seedEmailTemplates(db);
    await seedSampleForm(db);
  } finally {
    await client.end();
  }

  console.log(`Seeded ${USERS.length} console users, 4 email templates and form "hacker".`);
  console.log(`  admin     ${ADMIN.email} / ${SEED_PASSWORD}`);
  console.log(`  organizer ${ORGANIZER.email} / ${SEED_PASSWORD}`);
}

await main();
