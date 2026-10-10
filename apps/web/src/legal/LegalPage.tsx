import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Footer from '../components/Footer'

/**
 * Renders one of the Markdown documents in /content verbatim — headings, lists,
 * tables and all. Dropping a new .md in there is the whole editing workflow;
 * nothing about the document's structure is hardcoded here.
 */
export default function LegalPage({ source }: { source: string }) {
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-2.5" aria-label="PatriotHacks home">
            <img
              src="/logo.png"
              alt=""
              aria-hidden
              className="h-8 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <span className="font-display text-lg font-bold tracking-tight text-ink">
              PatriotHacks
            </span>
          </a>
          <a
            href="/"
            className="text-sm font-medium text-slate transition hover:text-ink"
          >
            ← Back to site
          </a>
        </div>
      </header>

      <main className="bg-paper px-6 py-16 sm:px-8 sm:py-20">
        <article className="prose prose-legal mx-auto max-w-3xl">
          <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
        </article>
      </main>

      <Footer />
    </>
  )
}
