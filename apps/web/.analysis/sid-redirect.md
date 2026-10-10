# /sid redirect

PR: https://github.com/PatriotHacks/patriothacks/pull/2
Branch: `sid-redirect` (commit f9aea4e, author harunkkhan, message `redirect /sid to the app` only)

## Conflict check (before editing)
- `PAGES` in vite.config.ts: /sponsor, /volunteer, /judge, /book, /privacy, /tos. No /sid.
- vercel.json rewrites: same six paths. No /sid.
- netlify.toml: same six + /apply, /001, SPA fallback. No /sid.
- No `sid.html` at root, nothing under `public/` named sid, no `src/sid*`.
- `grep -rn "/sid\|'sid'\|\"sid\""` (excluding node_modules, dist, .git): no matches.
- No client-side router (no react-router / pathname handling in src).

## Changes (mirror of dfb3bf0)
- vercel.json: `{ "source": "/sid", "destination": "https://app.patriothacks.org/sid", "permanent": false }` after /001.
- netlify.toml: `[[redirects]]` from /sid, status 302, force true, after /001 and above SPA fallback.
- vite.config.ts: `'/sid': 'https://app.patriothacks.org/sid'` in `EXTERNAL` after /001.
- README.md paragraph now reads: "`/apply`, `/001` and `/sid` are not pages — they are 302s off the site to <https://app.patriothacks.org/>, <https://app.patriothacks.org/001> and <https://app.patriothacks.org/sid>, declared in ..." (also reflowed the previously short "Temporary rather than" line).

## Verification
- vercel.json parsed with `JSON.parse`: OK, 3 redirects.
- netlify.toml parsed with Python `tomllib`: OK, order `/sponsor, /volunteer, /judge, /book, /privacy, /tos, /apply, /001, /sid, /*`.
- `npm run build` (`tsc -b && vite build`, node_modules already present): passed, 360 modules, built in 1.00s.
- Dev server `npx vite --port 5199 --strictPort` (5199 to avoid colliding with anything on 5173):
  - `curl -sI /sid` -> `HTTP/1.1 302 Found`, `Location: https://app.patriothacks.org/sid`
  - `curl -sI /sid/` -> 302, same Location (trailing slash stripped by the middleware)
  - `curl -sI /001` -> 302, `Location: https://app.patriothacks.org/001` (regression check)
  - Server killed afterward; follow-up request got no response.

## Notes
- `.analysis/` is not in .gitignore; this file is left untracked and was not committed.
- Push output mentioned 1 moderate Dependabot alert on the default branch (https://github.com/PatriotHacks/patriothacks/security/dependabot/6). Unrelated to this change.
- Vercel/Netlify redirects themselves were not exercised (would need a preview deploy); only the Vite dev middleware was curl-tested.
- Repo left on `master`, clean apart from untracked `.analysis/`.
