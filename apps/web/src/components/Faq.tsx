import { useState } from 'react'
import { FAQS } from '../config'

// Turn any email address in an answer into a clickable mailto link.
const EMAIL_RE = /([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/
function renderAnswer(text: string) {
  return text.split(EMAIL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={`mailto:${part}`}
        className="font-medium text-mason underline decoration-mason/40 underline-offset-2 transition hover:decoration-mason"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}

function FaqRow({
  q,
  a,
  isOpen,
  onToggle,
  index,
}: {
  q: string
  a: string
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  const panelId = `faq-panel-${index}`
  const btnId = `faq-btn-${index}`

  return (
    <div className="border-b border-line">
      <h3>
        <button
          id={btnId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 py-5 text-left"
        >
          <span className="text-base font-medium text-ink sm:text-lg">
            {q}
          </span>
          <span
            aria-hidden
            className={`shrink-0 transition-transform duration-300 ${
              isOpen ? 'rotate-180 text-mason' : 'text-slate'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-6 leading-relaxed text-slate">
            {renderAnswer(a)}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section
      id="faq"
      className="scroll-mt-32 bg-paper px-6 py-24 sm:px-10 sm:py-32 lg:px-20"
    >
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16 lg:gap-24">
        <header>
          <h2 className="text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Frequently asked questions
          </h2>
        </header>

        <div className="border-t border-line">
          {FAQS.map((item, i) => (
            <FaqRow
              key={item.q}
              index={i}
              q={item.q}
              a={item.a}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
