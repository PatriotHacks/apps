import { useEffect, useState } from 'react'
import Banner from './Banner'

const LINKS = [
  { href: '#sponsors', label: 'Sponsors' },
  { href: '#faq', label: 'FAQ' },
  { href: '/sponsor', label: 'Sponsor Us' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'border-b border-line bg-paper/85 backdrop-blur-md'
          : 'border-b border-transparent'
      }`}
    >
      <Banner />

      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a
          href="#top"
          className="flex items-center gap-2.5"
          aria-label="PatriotHacks home"
        >
          <img
            src="/logo.png"
            alt=""
            aria-hidden
            className="h-9 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            PatriotHacks
          </span>
        </a>

        <ul className="flex items-center gap-1 sm:gap-2">
          {/* MLH 2026 Season official trust badge — hangs from the top edge,
              left of the nav links. Official hosted asset per MLH guidelines. */}
          <li className="relative mr-1 w-14 self-stretch sm:mr-3 sm:w-16">
            <a
              href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=white"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute -top-1 right-0 z-50 block w-14 sm:w-16"
              aria-label="Major League Hacking 2026 Hackathon Season — official event"
            >
              <img
                src="https://s3.amazonaws.com/logged-assets/trust-badge/2026/mlh-trust-badge-2026-white.svg"
                alt="Major League Hacking 2026 Hackathon Season"
                className="w-full drop-shadow-md"
              />
            </a>
          </li>
          {LINKS.map((l) => (
            <li key={l.href} className="hidden sm:block">
              <a
                href={l.href}
                className="rounded-full px-3 py-2 text-sm font-medium text-slate transition hover:bg-mist hover:text-ink sm:px-4"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
