# PatriotHacks

George Mason University's hackathon — **coming Spring 2027**. One site, built
with **Vite + React + TypeScript + Tailwind CSS v4**.

| Page | URL | Source | What it is |
| --- | --- | --- | --- |
| **Home** | `/` | `index.html` → [`src/`](src) | Landing page — hero, sponsor grid, FAQ, interest-list email capture. |
| **Sponsor** | `/sponsor` | `sponsor.html` → [`src/sponsor/`](src/sponsor) | Sponsorship prospectus — the pitch, stats, past-sponsor reel, benefits. |
| **Volunteer** | `/volunteer` | `volunteer.html` → [`src/forms/volunteer.tsx`](src/forms/volunteer.tsx) | Volunteer application form → Supabase. |
| **Judge** | `/judge` | `judge.html` → [`src/forms/judge.tsx`](src/forms/judge.tsx) | Judge application form → Supabase. |
| **Book** | `/book` | [`public/book.html`](public/book.html) | Standalone Cal.com booking embed the sponsor page links to. |

Home, Sponsor, Volunteer, and Judge are four entry points of one Vite build, so
each page ships only its own JavaScript and keeps its own `<title>` and
social-preview tags. They share `src/index.css` (the green-and-gold-on-white
theme) and the parts of `src/config.ts` that they need. The two form pages are
the only ones that pull in the Supabase client.

## Run it locally

From the monorepo root:

```bash
pnpm install
pnpm --filter @patriothacks/web dev      # http://localhost:5173  (and /sponsor, /book)
pnpm --filter @patriothacks/web build    # type-check + production build → dist/
pnpm --filter @patriothacks/web preview  # serve the production build
pnpm --filter @patriothacks/web lint     # type-check only
```

## Editing content

Almost everything is data, not JSX.

**[`src/config.ts`](src/config.ts)** — the home page, plus anything shared:

- `CONTACT_EMAIL` — used by the contact band, both footers, and the FAQ.
- `SPONSOR_PAGE_URL` — where "Interested in Sponsoring?" points (`/sponsor`).
- `SPONSORS` — the home page's rotating logo grid. `logo` is optional; without
  it a tile shows the company name as text. Order in the array = order in the
  grid. Logo files live in `public/sponsors/`.
- `FAQS` — the accordion's question/answer list.
- `FOOTER` — code-of-conduct link, address lines, and social links. A social
  entry with an empty `href` renders greyed-out instead of clickable.
- `SIGNUP_ENDPOINT` — the interest-list capture (see below).
- `INTEREST_CARDS` — the two cards under the "Interested?" heading that link to
  `/volunteer` and `/judge`.

**[`src/forms/config.ts`](src/forms/config.ts)** — the two application forms:

- `VOLUNTEER_FORM` and `JUDGE_FORM` — title, description, questions, and
  required checkboxes for each. Both render through one shared component
  ([`src/forms/FormPage.tsx`](src/forms/FormPage.tsx)), so editing the data here
  is enough; you should not need to touch the JSX.
- Every field's `name` **must match a column** in the matching Supabase table.
  If you add a question here, add the column in
  [`schema.sql`](schema.sql) too.

**[`src/sponsor/config.ts`](src/sponsor/config.ts)** — the `/sponsor` page:

- `HERO`, `ABOUT`, `STATS`, `LOCATION` — the pitch, the stat rectangle, and the
  map block. Stats are projections; swap in real figures.
- `REEL_SPONSORS` — the past-sponsor marquee. These are a **separate logo set**
  under `public/sponsors/reel/`, because the reel flattens each logo to a black
  silhouette (`raw: true` opts a logo out of that filter). The home page's grid
  uses `public/sponsors/` instead.
- `TIERS` + `BENEFITS` — the tier/benefit matrix data. Prices ship as
  **placeholders**; replace them before sharing this with sponsors.
- `BOOK_MEETING_URL` — the "Book a meeting" target. To change which calendar it
  opens, edit `public/book.html`.
- `CONTACT_EMAIL` and `FOOTER` are re-exported from `src/config.ts`, so there is
  only one place to edit them.

### Wire up the email signups (private Google Sheet database)

The "Notify me" bar appends every email (with a timestamp) to a Google Sheet
only you can see — a hidden database. It POSTs to a Google Apps Script Web App,
so there's no backend to host and no secrets in the code.

1. Create a **Google Sheet** (this is your database). Optionally add a header
   row: `Timestamp | Email`.
2. In that Sheet: **Extensions → Apps Script**. Replace the placeholder code
   with the contents of [`apps-script/Code.gs`](apps-script/Code.gs) and save.
3. **Deploy → New deployment → Web app.** Set **Execute as: Me** and **Who has
   access: Anyone**, click Deploy, authorize, and copy the `/exec` URL.
4. Paste that URL into `SIGNUP_ENDPOINT` in `src/config.ts`.

Until `SIGNUP_ENDPOINT` is set, the bar runs in **demo mode**: it shows the
success message without storing anything. New emails then land as rows in your
Sheet. (Only people you share the Sheet with can read it — the endpoint URL
itself is safe to ship.)

### Wire up the volunteer & judge forms (Supabase)

The `/volunteer` and `/judge` forms write to two Supabase tables.

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste all of
   [`schema.sql`](schema.sql), and **Run**. That creates the
   `volunteers` and `judges` tables and locks them down (see below).
3. **Project Settings → API**: copy the **Project URL** and the **anon/public**
   key.
4. Locally: `cp .env.example .env` and paste both values in.
   For production: set the same two variables (`VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`) in your Vercel project settings, then
   redeploy — Vite inlines them at build time, so a redeploy is required for a
   change to take effect.

Until both are set, each form renders a visible "not connected to a database"
warning rather than silently discarding submissions.

Read the responses in **Table Editor → volunteers / judges**.

**How the security works.** The anon key ships inside the JavaScript bundle —
that is normal and expected. `schema.sql` revokes every default grant on the two
tables and grants `anon` nothing but `INSERT`, so that key can add a row and
can never read one. The applicant list is not reachable from the browser.

**Spam protection.** Two traps run in the browser, both checked *only after* the
submission is otherwise valid, so they can never swallow a real person's typo:

- a **honeypot** field ("Website") positioned off-screen and out of the tab
  order — invisible to people, irresistible to bots that fill every input;
- a **timing trap** rejecting anything that completes the whole form in under
  three seconds, which no human does.

A caught bot sees the normal success screen and nothing is written. Telling it
that it was caught would only teach its author what to fix.

Both are form-level, so they stop drive-by spam but **not** a script that posts
straight to the Supabase REST endpoint — the anon key is in the bundle, so that
path exists by design. What still applies to a direct post is everything the
database enforces: the length caps, the required-acknowledgement `CHECK`
constraints, and the unique email index. If the forms ever do attract a
determined bot, the fix is Cloudflare Turnstile verified in a Supabase Edge
Function, with `anon`'s `INSERT` grant revoked so the function is the only write
path. Per-IP rate limiting was deliberately left out: campus and dorm networks
put many students behind one address, and blocking real applicants is worse than
deleting a few junk rows.

**How the one-submission-per-email rule works.** Each table has a unique index
on `lower(email)`. The form does *not* look the email up first — doing that
would require granting the browser `SELECT` on every applicant. It just inserts,
and treats Postgres error `23505` (unique violation) as "this email already
applied." Same guardrail, no read access, and no race between two simultaneous
submissions. Email is lowercased before insert, so `Alex@gmu.edu` and
`alex@gmu.edu` count as one person. The two tables are independent, so the same
person may apply to volunteer *and* to judge.

## Deploy

One project, one build. Deployed on **Vercel** (`vercel.json`): build command
`pnpm build`, output `dist/`, **root directory `apps/web`**.

Each page is one flat `<name>.html` file at the `apps/web` root, not a
`<name>/index.html` folder. Vite names a page's build output after its input
path, so `volunteer.html` becomes `dist/volunteer.html`, and the rewrites map
the clean `/volunteer` URL onto it — same URLs, one file per page instead of one
directory per page. `vite.config.ts` applies the same mapping to the dev and
preview servers, so every URL resolves identically in all three.

> Adding a new page means touching **three** places: a new `<name>.html` at the
> root, `rollupOptions.input` and `PAGES` in `vite.config.ts`, and `rewrites` in
> `vercel.json`.

`/privacy` and `/tos` are the two legal documents. Each is a Vite entry that
imports a Markdown file from `content/` with `?raw` and renders it through
`react-markdown` (plus `remark-gfm`, so tables and strikethrough work), styled
by the `prose-legal` block in `src/index.css`. **Editing either policy means
editing only its `.md` file** — `content/PRIVACY.md` and `content/TERMS.md`.
Nothing about a document's structure is hardcoded, so headings, tables and
lists come through as written.

`/apply`, `/001`, `/sid`, `/kickoff`, `/bitlab` and `/zohra` are not pages — they are
temporary redirects off the site, declared in `redirects` in `vercel.json`
and `EXTERNAL` in `vite.config.ts`:

- `/apply` → <https://app.patriothacks.org/>
- `/001` → <https://app.patriothacks.org/001>
- `/sid` → <https://app.patriothacks.org/sid>
- `/kickoff` → <https://app.patriothacks.org/kickoff>
- `/bitlab` → <https://app.patriothacks.org/bitlab>
- `/zohra` → <https://app.patriothacks.org/zohra>

On Vercel each of these matches **case-insensitively and with or without a
trailing slash**, so `/bitlab`, `/BitLab` and `/BITLAB/` all land in the same
place. Vercel compiles a redirect `source` with `sensitive: true` and
`strict: true` and offers no option to relax either, so every slug is written
as a character class (`/([bB][iI][tT][lL][aA][bB])`) and listed twice — once
bare, once with the trailing slash. The dev and preview servers lowercase the
path before the `EXTERNAL` lookup to match Vercel.

Temporary rather than permanent so the application host can change between
seasons without browsers holding a cached redirect — Vercel sends 307 for
`"permanent": false`.

Remember to set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's
environment variables, or the two form pages will ship unconfigured.
