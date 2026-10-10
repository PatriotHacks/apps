import { INTEREST_CARDS } from '../config'

export default function Interested() {
  return (
    <section
      id="interested"
      className="scroll-mt-32 bg-paper px-6 py-24 sm:px-10 sm:py-32 lg:px-20"
    >
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16 lg:gap-24">
        <header>
          <h2 className="text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Interested?
          </h2>
          <p className="mt-5 max-w-sm leading-relaxed text-slate">
            PatriotHacks runs on people. Whether you want to work the event or
            help decide who wins it, we'd love to hear from you.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {INTEREST_CARDS.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="group flex flex-col justify-between border border-line bg-paper p-7 transition-colors hover:border-mason focus-visible:outline-offset-4"
            >
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-ink">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate">
                  {card.blurb}
                </p>
              </div>

              <span className="mt-8 inline-flex items-center gap-2 font-semibold text-mason">
                {card.cta}
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
