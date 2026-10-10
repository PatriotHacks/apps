import {
  BOOK_MEETING_URL,
  CONTACT_EMAIL,
  EVENT,
  FOOTER,
  INSTAGRAM,
} from '../config'

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ContactBand() {
  return (
    <section
      id="contact"
      className="scroll-mt-20 bg-mist px-5 py-20 text-center sm:px-8"
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Let's build something together
        </h2>
        <p className="mt-4 text-slate">
          Ready to sponsor, or want a custom package? Book a time with us, or reach
          out — we'll get back to you within 24 hours.
        </p>

        {/* Primary CTA */}
        <div className="mt-8">
          <a
            href={BOOK_MEETING_URL}
            className="inline-flex items-center justify-center bg-mason px-8 py-3.5 font-semibold text-white transition hover:bg-mason-deep"
          >
            Book a meeting
          </a>
        </div>

        {/* Other reach-out methods */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-10">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Sponsoring%20PatriotHacks%202027`}
            className="inline-flex items-center gap-2.5 font-medium text-slate transition hover:text-mason"
          >
            <MailIcon />
            {CONTACT_EMAIL}
          </a>
          <a
            href={INSTAGRAM.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 font-medium text-slate transition hover:text-mason"
          >
            <InstagramIcon />@{INSTAGRAM.handle}
          </a>
        </div>
      </div>
    </section>
  )
}

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <>
      <ContactBand />

      <footer className="bg-night px-5 py-14 text-slate sm:px-8 sm:py-16">
        <div className="flex flex-col items-center gap-10 text-center md:flex-row md:items-start md:justify-between md:text-left">
          {/* Left — identity */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-mono.png"
                alt=""
                aria-hidden
                className="h-10 w-auto invert"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <span className="font-display text-xl font-bold text-white">
                PatriotHacks
              </span>
            </div>
            <p className="mt-5 text-sm text-white/60">
              © {year} PatriotHacks · {EVENT.university}
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-1 text-sm text-white/60 transition hover:text-white"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

          {/* Right — links */}
          <div className="flex flex-col items-center gap-4 md:items-end">
            <a
              href={FOOTER.codeOfConductUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white/85 transition hover:text-white"
            >
              MLH Code of Conduct
            </a>
            <address className="text-sm not-italic leading-relaxed text-white/60 md:text-right">
              {FOOTER.address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>
        </div>
      </footer>
    </>
  )
}
