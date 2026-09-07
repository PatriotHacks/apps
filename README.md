# PatriotHacks Apps

Two apps sharing one database.

**Platform** (`apps/platform`) — where people apply. They sign in once and can fill out any published
form; each form lives at its own slug, so the hacker application is `/hacker`. Forms are filled a
section at a time, save as you go, and can branch — answering one question can change which sections
you see next. After submitting, you can edit whichever questions the organizers left unlocked.

**Admin console** (`apps/admin`) — where organizers run things. Build forms with any of 11 question
types, publish them (which freezes them permanently), read responses in a grid or one at a time,
leave review notes, issue accept/waitlist/reject decisions, and send email — decision notices, RSVP
confirmations, and broadcasts to a filtered audience.

Shared code lives in `packages/`: `database` (schema and migrations), `form-engine` (question types,
validation, branching), `emails` (templates and sending), `ui`, and `config`.

Full design rationale is in [`docs/SPEC.md`](docs/SPEC.md).

---

## Setup

**You need:** Node ≥20.9, pnpm 10, and a Supabase project.

### 1. Install

```bash
pnpm install
```

This also symlinks `.env` into both apps — Next.js doesn't read env files from a monorepo root.

### 2. Configure

```bash
cp .env.example .env
```

Fill it in. From your Supabase project's **Connect** dialog (or Project Settings → Database):

```bash
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres
DIRECT_DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Both use the **pooler** host and the same password. Only the port differs: 6543 pools connections for
the running app, 5432 is for migrations. Two things that cost people an afternoon:

- The pooler puts the project ref in the **username** (`postgres.abcdef...`). The direct
  `db.<ref>.supabase.co` host uses plain `postgres` — and is IPv6-only, so prefer the pooler.
- Transaction pooling on 6543 is not safe for DDL. That's why these are two variables.

The rest come from Project Settings → API, plus your own values:

```bash
NEXT_PUBLIC_SUPABASE_URL=        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # anon public key
SUPABASE_SERVICE_ROLE_KEY=       # service_role key - server only, never ships to the browser
RESEND_API_KEY=                  # for email
EMAIL_FROM=                      # e.g. PatriotHacks <apply@patriothacks.org>
PLATFORM_URL=http://localhost:3000
UNSUBSCRIBE_SECRET=              # any long random string: openssl rand -hex 32
NEXT_PUBLIC_AUTH_PROVIDERS=password
```

`NEXT_PUBLIC_AUTH_PROVIDERS` decides which buttons the login page renders — any of `password`,
`magic_link`, `google`, `github`, comma-separated. Enable the matching providers in the Supabase
dashboard first; the app only draws what you list here.

### 3. Create the schema

```bash
pnpm db:migrate
pnpm db:seed
```

Seeding gives you a working hacker application (5 sections, all 11 question types, real branching)
plus two accounts to sign in with:

| | |
|---|---|
| `admin@patriothacks.org` / `password123` | full access |
| `organizer@patriothacks.org` / `password123` | read submissions, add review notes |

Change those passwords before anyone else can reach the project.

### 4. Run

```bash
pnpm dev
```

Platform on **:3000**, admin console on **:3001**.

---

## Commands

```bash
pnpm dev          # both apps
pnpm build        # both apps
pnpm test         # 328 tests; 7 more need a live database (BROADCAST_DB_TESTS=1)
pnpm typecheck
pnpm lint

pnpm db:generate  # write a migration from schema changes
pnpm db:migrate   # apply migrations
pnpm db:seed      # sample form + accounts
```

Drizzle owns the schema. Edit `packages/database/src/schema/`, run `pnpm db:generate`, review the
generated SQL, then `pnpm db:migrate`. The Supabase CLI is only ever used to run local containers —
it never touches the `public` schema.

## Working on a local database instead

`pnpm db:reset` rebuilds a local Supabase stack in Docker from scratch. It needs Docker running and
roughly 10GB free, and it is the one path in this README not verified end to end — everything above
was.

---

## Things worth knowing before you change something

**Published forms are immutable.** Publishing validates the section graph — no unreachable sections,
no backward jumps — and then freezes the form, because responses are attached to it. To fix a typo,
clone into a new draft.

**Changing a branching answer deletes the answers on the path you left.** The app warns first and
names what it will discard, and the old values are kept in `answer_revisions`.

**Authorization lives in Postgres, not in the app.** Row-level security policies are the boundary.
The platform app can only reach the database through a wrapper that carries the signed-in user's
JWT, and a lint rule fails the build if it imports the service-role client. If a query returns
nothing you expected, check the policies before the code.

**Transactional email ignores the unsubscribe list; broadcasts respect it.** A rejection notice is
not marketing. That asymmetry is deliberate — don't "fix" it.
