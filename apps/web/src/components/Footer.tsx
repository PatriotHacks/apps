import { CONTACT_EMAIL, FOOTER } from '../config'
import SocialIcon from './SocialIcon'

function ContactBand() {
  return (
    <section className="bg-mist px-5 py-16 text-center sm:px-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">
          Questions?
        </h2>
        <p className="mt-3 text-slate">
          Reach out to{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-mason underline decoration-mason/40 underline-offset-4 transition hover:decoration-mason"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
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
        <div className="mx-auto grid max-w-6xl items-start gap-12 text-center md:grid-cols-2 md:text-left">
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
              © {year} PatriotHacks
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-1 text-sm text-white/60 transition hover:text-white"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

          {/* Right — code of conduct, socials, address */}
          <div className="flex flex-col items-center gap-5 md:items-end">
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:justify-end">
              <a
                href={FOOTER.codeOfConductUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-white/85 transition hover:text-white"
              >
                MLH Code of Conduct
              </a>
              <a
                href="/privacy"
                className="text-sm font-medium text-white/85 transition hover:text-white"
              >
                Privacy Policy
              </a>
              <a
                href="/tos"
                className="text-sm font-medium text-white/85 transition hover:text-white"
              >
                Terms of Service
              </a>
            </nav>

            <ul className="flex items-center gap-5">
              {FOOTER.socials.map((s) =>
                s.href ? (
                  <li key={s.platform}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.platform}
                      className="text-white/70 transition hover:text-gold"
                    >
                      <SocialIcon platform={s.platform} />
                    </a>
                  </li>
                ) : (
                  <li
                    key={s.platform}
                    aria-hidden
                    className="text-white/30"
                    title="Add a link in src/config.ts"
                  >
                    <SocialIcon platform={s.platform} />
                  </li>
                ),
              )}
            </ul>

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
