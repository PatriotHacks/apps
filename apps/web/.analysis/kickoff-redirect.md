# /kickoff redirect

PR: https://github.com/PatriotHacks/patriothacks/pull/3
Branch: `kickoff-redirect` (off `master` at `affb612`)
Commit: `93dce84` — `redirect /kickoff to the app`, author `harunkkhan <harunkkhan1@gmail.com>`

## Goal

`patriothacks.org/kickoff` 302s to <https://app.patriothacks.org/sid>. The
destination is `/sid`, not `/kickoff` — an intentional alias, mirroring commit
`f9aea4e` ("redirect /sid to the app") exactly.

## Pre-flight conflict check

Local `master` was 2 commits behind `origin/master`; fast-forwarded
`dfb3bf0 -> affb612` (which brought in `f9aea4e`, the `/sid` redirect the new
entries sit next to). Branched from there — nothing committed to `master`.

Nothing already served `/kickoff`:

- `PAGES` in `vite.config.ts` — no entry
- `rewrites` in `vercel.json` — no entry
- `netlify.toml` — no `[[redirects]]` block
- `public/`, `src/` — no matching file or route
- `git grep -rni kickoff` and a filesystem grep (excluding `node_modules`,
  `.git`, `dist`) both returned zero hits

No conflict, so proceeded.

## Changes (4 files, +21 / -7)

Each new entry sits directly after the `/sid` entry, matching `f9aea4e`:

- `vercel.json` — `redirects`: `{ "source": "/kickoff", "destination": "https://app.patriothacks.org/sid", "permanent": false }`
- `netlify.toml` — `[[redirects]]` with `from = "/kickoff"`, `to = "https://app.patriothacks.org/sid"`, `status = 302`, `force = true`, above the SPA fallback
- `vite.config.ts` — `EXTERNAL`: `'/kickoff': 'https://app.patriothacks.org/sid'`
- `README.md` — the redirect paragraph was becoming a run-on sentence with four
  paths and four URLs, so the targets moved into a bullet list. The `/kickoff`
  bullet notes it is the same target as `/sid` and an intentional alias. The
  "Temporary rather than permanent so the application host can change between
  seasons without browsers holding a cached redirect." rationale sentence is
  unchanged (only rewrapped onto two lines after the list).

## Verification

1. `vercel.json` parses as JSON (`node -e "require('./vercel.json')"`), all four
   redirects present and well-formed.
2. `npm run build` (`tsc -b && vite build`) — passed, 360 modules, built in
   1.21s, no type or build errors.
3. Vite dev server on port 5199 (`npx vite --port 5199 --strictPort`):

   ```
   /kickoff  ->  HTTP/1.1 302 Found   Location: https://app.patriothacks.org/sid
   /sid      ->  HTTP/1.1 302 Found   Location: https://app.patriothacks.org/sid
   /001      ->  HTTP/1.1 302 Found   Location: https://app.patriothacks.org/001
   /apply    ->  HTTP/1.1 302 Found   Location: https://app.patriothacks.org/
   ```

   Both `/kickoff` and `/sid` end at `.../sid` as intended; the pre-existing
   redirects were unaffected. Server stopped afterwards (no listener on 5199).

## Notes / surprises

- Two environment quirks, neither related to the change: `curl` resolved to a
  broken `/opt/anaconda3/bin/curl` shim in this shell (used `/usr/bin/curl`
  explicitly), and the Vite dev server bound only IPv6 `[::1]:5199`, so requests
  to `127.0.0.1` got connection-refused until switched to `http://[::1]:5199`.
- `gh pr create` warned "1 uncommitted change" — that is the pre-existing
  untracked `.analysis/` directory, not part of this work.
- Unrelated: GitHub reports 1 moderate Dependabot vulnerability on the default
  branch (`security/dependabot/6`).
- Commit message is the single line `redirect /kickoff to the app` with no
  Co-Authored-By, session link, or other attribution; PR body likewise.
