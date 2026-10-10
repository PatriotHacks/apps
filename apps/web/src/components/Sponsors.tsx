import { useEffect, useMemo, useState } from 'react'
import { SPONSORS, SPONSOR_PAGE_URL, type Sponsor } from '../config'

const COLS = 4
const SLIDE_MS = 800 // vertical slide duration (per column)
const STAGGER_MS = 300 // delay between columns so they rotate left → right (they overlap)
const CASCADE_MS = SLIDE_MS + (COLS - 1) * STAGGER_MS // full left-to-right sweep
const HOLD_MS = CASCADE_MS + 1800 // dwell on a formed set before the next sweep

function Cell({ s }: { s: Sponsor }) {
  const inner = s.logo ? (
    <img
      src={s.logo}
      alt={s.name}
      loading="lazy"
      className="w-auto max-w-full object-contain"
      style={{ maxHeight: `${36 * (s.scale ?? 1)}px` }}
    />
  ) : (
    <span className="text-center text-base font-semibold leading-tight text-ink sm:text-lg">
      {s.name}
    </span>
  )
  return s.url ? (
    <a
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={s.name}
      className="flex items-center opacity-80 transition hover:opacity-100"
    >
      {inner}
    </a>
  ) : (
    inner
  )
}

export default function Sponsors() {
  // Round-robin the sponsors into COLS vertical reels, padded to equal length.
  const columns = useMemo(() => {
    const cols: Sponsor[][] = Array.from({ length: COLS }, () => [])
    SPONSORS.forEach((s, i) => cols[i % COLS].push(s))
    const L = Math.max(1, ...cols.map((c) => c.length))
    cols.forEach((c) => {
      let k = 0
      while (c.length > 0 && c.length < L) c.push(c[k++ % c.length])
    })
    return cols
  }, [])

  const L = columns[0]?.length ?? 1
  const [step, setStep] = useState(0)
  const [animate, setAnimate] = useState(true)

  // Advance all reels together every HOLD_MS (rotate to the next set).
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || L <= 1) return
    const id = setInterval(() => setStep((s) => s + 1), HOLD_MS)
    return () => clearInterval(id)
  }, [L])

  // Seamless loop: after sliding onto the duplicated first row, snap back.
  useEffect(() => {
    if (step === L) {
      const t = setTimeout(() => {
        setAnimate(false)
        setStep(0)
      }, CASCADE_MS)
      return () => clearTimeout(t)
    }
    if (!animate) {
      const r = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimate(true)),
      )
      return () => cancelAnimationFrame(r)
    }
  }, [step, L, animate])

  const shiftPct = 100 / (L + 1)

  return (
    <section
      id="sponsors"
      className="scroll-mt-32 bg-mist px-6 py-24 sm:px-10 sm:py-32 lg:px-20"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-14 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Our previous sponsors
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate">
            Thank you to the amazing sponsors that make PatriotHacks possible.
          </p>
        </header>

        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-6">
          {columns.map((col, ci) => {
            const track = [...col, col[0]] // duplicate first for seamless loop
            return (
              <div key={ci} className="h-24 overflow-hidden">
                <div
                  className="flex flex-col will-change-transform"
                  style={{
                    transform: `translateY(-${step * shiftPct}%)`,
                    transition: animate
                      ? `transform ${SLIDE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
                      : 'none',
                    transitionDelay: animate ? `${ci * STAGGER_MS}ms` : '0ms',
                  }}
                >
                  {track.map((s, ri) => (
                    <div
                      key={ri}
                      aria-hidden={ri >= col.length}
                      className="flex h-24 shrink-0 items-center justify-center px-2"
                    >
                      <Cell s={s} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-16 text-center">
          <a
            href={SPONSOR_PAGE_URL}
            className="inline-block bg-mason px-8 py-3.5 font-semibold text-white transition hover:bg-mason-deep"
          >
            Interested in Sponsoring?
          </a>
        </div>
      </div>
    </section>
  )
}
