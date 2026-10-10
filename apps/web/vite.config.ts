import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Bare paths for the non-root pages. Each page is a single flat .html file
 * rather than a <name>/index.html folder — Vite names a page's output after
 * its input path, so `volunteer.html` builds to `dist/volunteer.html` and the
 * rewrites below (and in vercel.json) map the clean `/volunteer`
 * URL onto it. Same URLs, no directory per page.
 *
 * /sponsor, /volunteer and /judge are Vite entries; /book is a standalone
 * static file served straight from public/.
 */
const PAGES: Record<string, string> = {
  '/sponsor': '/sponsor.html',
  '/volunteer': '/volunteer.html',
  '/judge': '/judge.html',
  '/book': '/book.html',
  '/privacy': '/privacy.html',
  '/tos': '/tos.html',
}

/** Bare paths that leave the site entirely. 302 so the target can move. */
const EXTERNAL: Record<string, string> = {
  '/apply': 'https://app.patriothacks.org/',
  '/001': 'https://app.patriothacks.org/001',
  '/sid': 'https://app.patriothacks.org/sid',
  '/kickoff': 'https://app.patriothacks.org/kickoff',
  '/bitlab': 'https://app.patriothacks.org/bitlab',
  '/zohra': 'https://app.patriothacks.org/zohra',
}

function pageRoutes(): Plugin {
  const handle = (
    req: { url?: string },
    res: { writeHead: (code: number, headers: Record<string, string>) => void; end: () => void },
  ) => {
    // req/res are typed without @types/node here, so narrow to what is used.
    const path = req.url?.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
    // Vercel matches the EXTERNAL sources case-insensitively and with or without
    // a trailing slash, so lowercase before the lookup. The PAGES rewrites stay
    // case-sensitive here because they are case-sensitive in production too.
    const target = EXTERNAL[path.toLowerCase()]
    if (target) {
      res.writeHead(302, { Location: target })
      res.end()
      return true
    }
    const page = PAGES[path]
    if (page) {
      req.url = page
    }
    return false
  }
  return {
    name: 'page-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handle(req as { url?: string }, res)) next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handle(req as { url?: string }, res)) next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pageRoutes()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        sponsor: 'sponsor.html',
        volunteer: 'volunteer.html',
        judge: 'judge.html',
        privacy: 'privacy.html',
        tos: 'tos.html',
      },
    },
  },
})
