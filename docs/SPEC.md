# PatriotHacks Application Platform — Technical Spec

Monorepo containing two apps: a public-facing application platform where users fill out forms,
and an admin console where organizers build those forms, review responses, and issue decisions.

Status: planning complete, implementation not started.

---

## 1. Decisions

Every choice below was made explicitly. Where a decision is still open it is listed in Section 14.

| Area | Decision |
|---|---|
| Repo | pnpm workspaces + Turborepo, two Next.js apps |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| DNS | Cloudflare (`app.` and `admin.patriothacks.org`) |
| Database | Supabase Postgres — local Docker for dev, hosted project for prod |
| Schema | Drizzle ORM owns it; `drizzle-kit generate` + `drizzle-kit migrate` is the only migration tool |
| Connection | Supavisor transaction-mode pooler (port 6543) from Workers |
| Authorization | RLS-first; policies are the boundary, service role only in admin paths |
| Auth | Supabase Auth; providers enabled in dashboard, login UI driven by env config |
| Admin roles | `admin`, `organizer` |
| Question types | All 11 |
| Form structure | Sections + conditional branching |
| Form lifecycle | Immutable once published |
| Branch switching | Answers on the abandoned path are deleted |
| Answer history | Append-only `answer_revisions` (covers edits and branch discards) |
| Post-decision edits | No effect — no flag, no status change |
| Review model | Free-for-all, notes only, no scores, no claiming |
| Response viewing | Grid with server-side pagination + per-submission detail view |
| Email | Decisions + RSVP + broadcasts, via Resend, templates editable in console |
| File uploads | PDF only, 10MB, private bucket, signed-URL downloads |
| Scale target | 500-2000 submissions |
| Timeline | No fixed deadline; sequenced by dependency |
| Design | Tailwind + shadcn/ui, neutral palette, CSS variables for later re-theming |

---

## 2. Assumptions

Stated rather than asked. Contradict any of these and the affected section changes.

1. One Supabase project for production, a second for staging.
2. One submission per user per form, enforced by a unique constraint. This is what makes
   "edit your submission" coherent rather than "submit twice."
3. Drafts autosave as the user types; a submission exists in `draft` status before it is submitted.
4. Everything is behind login. `/hacker` bounces to sign-in and returns after auth.
5. `forms.visibility` exists and defaults to `public`, but no gating UI ships in v1. It is an
   escape hatch so a judges-only or post-acceptance form does not require a migration mid-season.
6. Soft deletes on forms and submissions. Nothing is hard-deleted through the UI.
7. All timestamps stored UTC, rendered in `America/New_York`.
8. No realtime subscriptions. The admin grid refreshes on navigation and on mutation.
9. No virus scanning on uploads.
10. English only, no i18n.
11. A seed script creates an admin user and a sample branching form so a fresh clone is usable
    immediately after `pnpm db:reset`.
12. Transactional decision and RSVP email ignores the unsubscribe list. Broadcasts respect it.

---

## 3. Repository layout

```
apps/
  platform/              app.patriothacks.org
  admin/                 admin.patriothacks.org
packages/
  database/              drizzle schema, migrations, client factory, seed
  form-engine/           question type registry, renderer, validator, branch traversal
  ui/                    shadcn components, tokens, shared layout primitives
  emails/                react-email layouts (shell only; copy lives in the DB)
  config/                eslint, tsconfig, tailwind preset
docs/
  SPEC.md
supabase/
  config.toml            local stack only; owns no schema
```

`packages/form-engine` is shared deliberately. The renderer that draws a question for an applicant
and the preview inside the admin builder must be the same code, or they will drift and the preview
will lie.

---

## 4. Hosting and runtime

Both apps deploy to Cloudflare Workers through the OpenNext adapter.

```jsonc
// wrangler.jsonc
{
  "main": ".open-next/worker.js",
  "compatibility_date": "<date>",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "binding": "ASSETS", "directory": ".open-next/assets" },
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "<worker-name>" }],
  "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "<worker>-cache" }]
}
```

**Next.js version is pinned by the adapter** — `@opennextjs/cloudflare@1.20.6` declares
`next: >=15.5.24 <16 || >=16.3.3`. Pinned to `next@15.5.25`. Read the peer range off the installed
adapter rather than the docs; the published support policy is wider than any given release. Do not
upgrade Next without checking adapter support first.

### Database connection

Workers connect through Supabase's Supavisor pooler in transaction mode, not Hyperdrive.

Reasoning: RLS-first requires wrapping every user query in a transaction that sets
`request.jwt.claims` and `set local role`. Cloudflare's own Hyperdrive documentation advises
against using transactions to carry session state, and requires cache-disabled bindings for
permission-dependent queries — which, under RLS, is every query. Supavisor is built for exactly
this pattern and has no result cache to poison.

- Runtime (Workers): Supavisor transaction mode, port **6543**
- Migrations (CI and local, Node): direct connection or session mode, port **5432** — transaction-mode
  pooling is not safe for DDL
- `pg` >= 8.13, client constructed **inside** the request handler, never at module scope

---

## 5. Schema ownership and migrations

Drizzle is the single source of truth. The Supabase CLI runs containers and never touches `public`.

```ts
// drizzle.config.ts
export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/database/schema/*.ts",
  out: "./packages/database/drizzle",
  schemaFilter: ["public"],   // required: keeps drizzle-kit out of auth/storage/realtime/vault
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL! },
});
```

`schemaFilter` is not optional. drizzle-kit 1.0 changed the default from `["public"]` to managing
all schemas; without this line it will generate migrations against the schemas GoTrue and Storage own.

Local rebuild:

```
pnpm db:reset = supabase db reset --no-seed && drizzle-kit migrate && pnpm db:seed
```

Production: `drizzle-kit migrate` from CI against the direct connection string.

---

## 6. Database schema

### Enums

```
admin_role        admin | organizer
form_status       draft | published | closed
form_visibility   public | role | gated
form_edit_policy  locked | per_question | full
question_type     short_answer | paragraph | multiple_choice | checkboxes | dropdown
                  | linear_scale | date | time | grid_multiple_choice | grid_checkbox
                  | file_upload
option_kind       choice | grid_row | grid_column
branch_action     next | section | submit
submission_status draft | submitted | under_review | accepted | waitlisted | rejected | withdrawn
rsvp_status       pending | confirmed | declined
revision_reason   edit | branch_discarded
email_status      queued | sent | failed | bounced
broadcast_status  draft | sending | sent | failed
```

### Identity

**profiles** — one row per human, created by a trigger on `auth.users` insert.
`id` (PK, FK to `auth.users.id`, cascade delete), `email`, `full_name`, `created_at`, `updated_at`.

**admins** — presence in this table grants console access.
`user_id` (PK, FK profiles), `role admin_role`, `created_at`, `created_by`.

### Form definition

**forms**
`id`, `slug` (unique — this is what makes `/hacker` data rather than code), `title`, `description`,
`status form_status`, `visibility form_visibility default 'public'`,
`edit_policy form_edit_policy default 'locked'`, `opens_at`, `closes_at`, `published_at`,
`created_by`, `created_at`, `updated_at`, `deleted_at`.

`edit_policy` is the direct encoding of the requirement that admins decide what can be re-answered:
`locked` (nothing after submit), `per_question` (only questions flagged editable), `full` (everything).

**form_sections**
`id`, `form_id` (cascade), `title`, `description`, `position`, `next_action branch_action default 'next'`,
`next_section_id` (nullable self-FK). Unique on `(form_id, position)`.

`next_action` is the section's default exit: continue in order, jump to a specific section, or submit.

**questions**
`id`, `section_id` (cascade), `form_id` (denormalized for RLS and query convenience),
`type question_type`, `label`, `help_text`, `position`, `required bool`,
`editable_after_submit bool default false`, `config jsonb`, `created_at`, `updated_at`.
Unique on `(section_id, position)`.

`config` holds type-specific settings that do not deserve columns: linear scale min/max and endpoint
labels, validation rules (min/max length, number range, regex), and file constraints. Everything
that needs to be queried or joined is a real column.

**question_options** — serves three purposes via `kind`.
`id`, `question_id` (cascade), `kind option_kind`, `label`, `value`, `position`,
`next_action branch_action default 'next'`, `next_section_id` (nullable FK form_sections).
Unique on `(question_id, kind, position)`.

`kind = 'choice'` for multiple choice, checkboxes, and dropdown. `kind = 'grid_row'` and
`'grid_column'` define the two axes of a grid question. One table instead of three, and grid axes
stay queryable, which matters for generating export columns.

Per-option `next_section_id` is where branching lives: "if they answered X, go to section Y."

### Responses

**submissions**
`id`, `form_id`, `user_id`, `status submission_status default 'draft'`, `submitted_at`, `decided_at`,
`decided_by`, `rsvp_status`, `rsvp_at`, `created_at`, `updated_at`.
Unique on `(form_id, user_id)`.

**answers**
`id`, `submission_id` (cascade), `question_id`, `value jsonb not null`, `updated_at`.
Unique on `(submission_id, question_id)`. Index on `(question_id, submission_id)`.

`value` shape by type:

```
short_answer, paragraph, dropdown,
multiple_choice, date, time         "string"
linear_scale                         3
checkboxes                           ["a", "b"]
grid_multiple_choice                 { "row_id": "col_id" }
grid_checkbox                        { "row_id": ["col_id", ...] }
file_upload                          { "path": "...", "name": "...", "size": 12345 }
```

**answer_revisions** — append-only, written by trigger on update and delete of `answers`.
`id`, `submission_id`, `question_id`, `prev_value jsonb`, `reason revision_reason`,
`edited_by`, `edited_at`.

Deliberately keyed on `(submission_id, question_id)` rather than FK'd to `answers.id`: branch
discards delete the answer row, and the revision has to outlive it. This table is the only thing
standing between a mistakenly toggled radio button and permanently lost work.

### Review and decisions

**submission_reviews**
`id`, `submission_id` (cascade), `reviewer_id`, `notes text`, `created_at`, `updated_at`.

No score column and no claim state — free-for-all review, notes only, by decision. Any organizer
can review any submission; multiple reviews per submission are expected.

### Email

**email_templates** — `id`, `key` (unique), `subject`, `body_html`, `body_text`, `updated_by`, `updated_at`.
Seeded keys: `decision_accepted`, `decision_waitlisted`, `decision_rejected`, `rsvp_confirmed`.

**broadcasts** — `id`, `name`, `subject`, `body_html`, `body_text`, `audience_filter jsonb`,
`status broadcast_status`, `recipient_count`, `created_by`, `created_at`, `sent_at`.

**email_sends** — `id`, `template_key`, `broadcast_id` (nullable), `to_user_id`, `to_email`,
`subject`, `provider_message_id`, `status email_status`, `error`, `created_at`, `sent_at`.

**email_unsubscribes** — `user_id` (PK), `unsubscribed_at`. Consulted for broadcasts only.

### Indexes beyond the constraints above

```
submissions (form_id, status)
submissions (user_id)
answers     (question_id, submission_id)
forms       (slug) where deleted_at is null
email_sends (to_user_id, created_at desc)
```

---

## 7. Authorization

### The Drizzle RLS client

Drizzle talks to Postgres directly, so RLS is not enforced unless the session role and JWT claims are
set per transaction. `packages/database` exports a factory returning two clients:

```ts
createDrizzleSupabaseClient() -> { admin, rls }
```

- `rls(tx => ...)` opens a transaction, sets `request.jwt.claims`, `request.jwt.claim.sub`, and
  `set local role authenticated`, runs the callback, then resets. Used for everything user-scoped.
- `admin` is the service-role connection. Used only in admin console paths, after an explicit
  `admins` table role check.

**The failure mode to design against:** forgetting the wrapper does not raise an error. The query
simply runs as the connection role with RLS bypassed and returns everyone's data. Mitigations:
the platform app never imports `admin`, enforced by an ESLint rule; and the platform's database
module exports only the wrapped client.

### Policy summary

| Table | authenticated | organizer | admin |
|---|---|---|---|
| profiles | own row (rw) | read all | read all |
| forms | read published | read all | full |
| form_sections, questions, question_options | read if parent form published | read all | full |
| submissions | own rows (rw, insert) | read all | read all, set status |
| answers | own, subject to edit policy | read all | read all |
| answer_revisions | none | read all | read all |
| submission_reviews | none | own (rw), read all | read all |
| email_*, broadcasts | none | none | full |

The edit-permission requirement expressed as a policy:

```sql
create policy answers_update_own on answers for update to authenticated
using (
  exists (
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
  )
);
```

That single policy is the whole "which questions can be updated with new responses" feature. It
cannot be bypassed by a bug in the UI.

---

## 8. Form engine

Lives in `packages/form-engine`, shared by the applicant renderer and the admin builder preview.

### Question type registry

Each of the 11 types registers four things: a builder editor, an applicant renderer, a Zod
validator built from `questions.config`, and an export serializer that turns a `value` into one or
more CSV cells. Adding a type means adding one registry entry, not touching four codebases.

### Branch traversal

The form is a directed graph of sections. Traversal resolves in this order:

1. If the section contains a branching question and the user selected an option with
   `next_action = 'section'`, go to `next_section_id`.
2. Otherwise apply the section's own `next_action`.
3. Otherwise advance to the next section by `position`.

Two invariants the builder must enforce at publish time, since a published form is immutable and a
bad graph cannot be repaired:

- **No unreachable sections.** Every section is reachable from the first.
- **No cycles.** A jump target must have a higher `position` than its source, which makes cycles
  structurally impossible and keeps the progress indicator honest.

### Reachability and validation

Required-field validation runs only against reachable questions. The reachable set is computed from
current answers, server-side, on submit. Client-side validation is a convenience; the server
recomputes and is authoritative.

### Branch discard

When an answer changes such that a previously reachable section becomes unreachable, answers for
every question in the orphaned subtree are deleted in the same transaction as the triggering update.
The delete trigger writes each prior value to `answer_revisions` with `reason = 'branch_discarded'`,
so the data is recoverable by an admin even though it is gone from the applicant's view.

The applicant is warned before this happens. Silent destruction of a page of typing is not acceptable.

---

## 9. Platform app

Routes:

```
/                    form index — all published forms, with this user's status per form
/[slug]              fill or edit a form
/[slug]/review       read-only summary of a submitted application
/submissions         all of this user's submissions across forms
/login               provider buttons rendered from env config
```

Behavior:

- Drafts autosave on a debounce. A `draft` submission row is created on first interaction.
- Submit transitions `draft -> submitted`, stamps `submitted_at`, and runs server-side validation
  over the reachable question set.
- After submission, editability is governed entirely by `forms.edit_policy` and
  `questions.editable_after_submit`. The UI reflects it; RLS enforces it.
- Editing after a decision changes nothing — no flag, no status change, by decision.
- Forms outside their `opens_at`/`closes_at` window render read-only with an explanation.

---

## 10. Admin console

```
/forms                       list, status, response counts
/forms/new                   builder
/forms/[id]                  builder (draft only) or read-only view (published)
/submissions                 one row per form, with its response count
/submissions/[formId]        response grid
/submissions/[formId]/[submissionId]   detail view
/designs                     design materials: uploaded files and links
/emails/templates            template editor
/emails/broadcasts           audience builder and send
/newsletters                 saved newsletter designs
/newsletters/new             block builder
/newsletters/[id]            block builder
/settings/admins             role management (admin only)
```

### Builder

Section and question management with up/down reordering, all 11 question types, per-option branch targets,
per-question `editable_after_submit`, and form-level `edit_policy`. Live preview uses the shared
renderer. Publish runs the graph validation from Section 8 and is irreversible.

### Response grid

Server-side pagination, filtering, and sorting — required at 500-2000 submissions. Columns are
generated from the form's questions, toggleable and resizable. Filtering on a specific question's
answer compiles to an `EXISTS` subquery against `answers`.

Implementation note: do not write a SQL pivot. Paginate `submissions` with filters applied, then
fetch `answers` for that page's submission ids in one query and pivot in application code. Simpler,
and it keeps the query planner honest.

### Detail view

Full application rendered as a readable document, with the notes panel beside it, decision controls,
answer revision history per question, and previous/next navigation to move through the pile without
returning to the grid.

### Export

Streamed CSV of whatever the current filter selects. Two shapes worth noting:

- **Branching leaves holes.** A respondent who never saw a section has empty cells for it. These are
  genuinely empty, not missing data, and the export marks them distinctly from an unanswered
  optional question.
- **Grids expand.** A grid question becomes one column per row, not one column total.

Streamed rather than buffered — a Worker has limited memory and 2000 submissions of long-form text
will not fit comfortably.

---

## 11. Email

Provider: Resend. Local development uses the Supabase stack's Inbucket, so nothing real is sent
while testing.

**Transactional** — decision emails (accepted, waitlisted, rejected) sent individually or to a
filtered set from the response grid, and RSVP confirmations. These ignore the unsubscribe list.

**RSVP** — accepted applicants confirm or decline, writing `submissions.rsvp_status`, which triggers
a confirmation email.

**Broadcasts** — compose, select an audience by filter (all accepted, everyone who applied to form X,
all mentors), preview against a real recipient, send. Respects `email_unsubscribes`. Every recipient
gets an `email_sends` row.

At 2000 recipients, sending happens in batches with retry, not in a single request handler. Worker
CPU limits make a synchronous 2000-send loop a non-starter.

Templates are stored in the database with `{{variable}}` interpolation and edited in the console.
The layout shell lives in `packages/emails`; organizers own the words, not the rendering.

**Newsletters** — a newsletter is a design, not a send. Organizers assemble a recurring issue from
typed blocks (heading, paragraph, image, button, divider) in `/newsletters`, preview it, and save it
to the `newsletters` table as jsonb. A broadcast then loads one, which compiles the blocks into its
own `body_html` and `body_text` and copies them onto the broadcast row — so audience selection and
sending stay entirely with broadcasts, and editing or deleting a design never changes anything
already queued or sent. The compiler lives in `packages/emails` beside the layout shell: it emits
body-level, table-based, inline-styled markup only, escapes every authored string while leaving
`{{variable}}` intact for interpolation at send time, and validates every URL as `http:` or `https:`
in the schema. Inline links are written as `[label](url)` and entered as form fields, so no organizer
ever hand-writes an anchor.

Sending requires SPF, DKIM, and DMARC records on `patriothacks.org` — which is a point in favor of
the domain already being on Cloudflare.

---

## 12. Storage

Two private buckets, with different shapes because the uploads reach them differently.

### `submissions` — applicant uploads

Private Supabase Storage bucket. Objects at `{user_id}/{submission_id}/{question_id}`.

- PDF only, 10MB max
- Type validated server-side by magic bytes, not by extension or by trusting the file picker
- Bucket policy restricts writes to the owning user's prefix
- Admin downloads issue a 60-second signed URL; the bucket is never public

### `designs` — design materials

Private bucket behind the console's Designs section. Objects at `{asset_id}/{file_name}`, so a
signed URL downloads under the name the file was uploaded with.

- PNG, JPEG, WebP, GIF, SVG, PDF and ZIP, 25MB max
- The browser uploads straight to storage on the admin's own session and a server action records
  the row afterwards. Nothing streams through the app: a server action body is capped at 1MB by
  default, and pushing 25MB through a Worker is the wrong shape.
- Which means type and size are enforced by the bucket's own `allowed_mime_types` and
  `file_size_limit` rather than by magic bytes — there are no bytes on the server to inspect. The
  `accept` attribute and the check in the action only keep the console from offering what the
  bucket would refuse.
- Object policies: read to `is_organizer()`, write to `is_admin()`. An organizer's upload is
  refused by the database, not by the console hiding the control.
- Reads issue a 60-second signed URL; the bucket is never public. Raster images get a thumbnail;
  SVG and PDF are never rendered inline in the console, because an uploaded SVG is untrusted
  markup — they open in their own tab through the signed URL.
- A failed insert removes the object it had already uploaded, so a file nothing names cannot
  accumulate.

---

## 13. Build order

No fixed deadline, so this is sequenced by dependency rather than by triage.

| Phase | Scope |
|---|---|
| 0 | Monorepo scaffold, Docker stack, Drizzle schema, migrations, seed |
| 1 | Auth, profiles trigger, admins table, RLS client factory and lint rule |
| 2 | Form engine: type registry, renderer, validators — no branching yet |
| 3 | Platform: form index, fill, autosave, submit, view submissions |
| 4 | Branching: traversal, reachability validation, discard + revisions |
| 5 | Admin builder, including publish-time graph validation |
| 6 | Response grid, detail view, streamed CSV export |
| 7 | Decisions and review notes |
| 8 | Email: templates, decisions, RSVP |
| 9 | Broadcasts, audience builder, unsubscribe |
| 10 | Cloudflare deploy, staging project, full dry run |

Phase 4 is the single largest and riskiest piece. Phase 2 deliberately ships without branching so
the type registry is proven against real submissions before the graph logic lands on top.

---

## 14. Open items

1. **Frozen-form escape hatch — unresolved.** A published form is immutable, but a typo will happen.
   Options: clone into a new draft and reassign the slug; allow display-text-only edits; or hard
   freeze with no recourse. **Assumed for now: clone and reassign**, since it preserves existing
   responses and keeps `/hacker` working. Needs confirmation.
2. **Existing data.** No answer yet on whether prior PatriotHacks responses need importing.
3. **Export format.** CSV assumed. Say if XLSX is needed — it changes the export library.
4. **Staging.** Assumed a second Supabase project. Supabase branching is an alternative but
   interacts awkwardly with Drizzle owning migrations.

---

## 15. Risks

**Branch traversal correctness.** The highest-risk component by a distance. Reachability affects
validation, export shape, and destructive deletes simultaneously. This needs property-based tests
over generated form graphs, not just example tests.

**The RLS wrapper is silently skippable.** Forgetting `db.rls(...)` bypasses every policy without
erroring. The lint rule and the module boundary in Section 7 are load-bearing, not nice-to-have.

**Workers plus transaction-per-query is unproven here.** Supavisor is built for it, but this specific
combination — OpenNext, node-postgres over Supavisor, a transaction on every read — should get a
spike in Phase 0 rather than a discovery in Phase 6.

**Form immutability has no escape hatch yet.** See Open Items 1. Shipping without deciding this
means the first typo becomes an emergency.

**Broadcast correctness.** An unsubscribe bug emails people who opted out. This is the piece most
likely to cause real-world embarrassment, and it ships last for that reason.
