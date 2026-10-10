import { useEffect, useState } from 'react'
import { ABOUT, EVENT, LOCATION, STATS } from '../config'
import SponsorReel from './SponsorReel'

const cardClass =
  'rounded-lg border border-solid border-slate/30 overflow-hidden'

/**
 * Vertically rotating list — one item shown at a time, sliding up to the next
 * and looping seamlessly (a duplicate of the first item lets it wrap without a
 * visible jump). Static for reduced-motion.
 */
function VerticalRotator({ items }: { items: readonly string[] }) {
  const L = items.length
  const [step, setStep] = useState(0)
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || L <= 1) return
    const id = window.setInterval(() => setStep((s) => s + 1), 2600)
    return () => window.clearInterval(id)
  }, [L])

  // After sliding onto the duplicated first item, snap back to the real first.
  useEffect(() => {
    if (step === L) {
      const t = window.setTimeout(() => {
        setAnimate(false)
        setStep(0)
      }, 600)
      return () => window.clearTimeout(t)
    }
    if (!animate) {
      const r = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimate(true)),
      )
      return () => cancelAnimationFrame(r)
    }
  }, [step, L, animate])

  const track = [...items, items[0]]
  const shiftPct = 100 / (L + 1)

  return (
    <div className="h-16 overflow-hidden sm:h-20">
      <div
        className="flex flex-col"
        style={{
          transform: `translateY(-${step * shiftPct}%)`,
          transition: animate
            ? 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
        }}
      >
        {track.map((t, i) => (
          <div
            key={i}
            className="flex h-16 shrink-0 items-center justify-center font-display text-xl font-bold leading-tight tracking-tight text-ink sm:h-20 sm:text-2xl"
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function About() {
  return (
    <section
      id="about"
      className="scroll-mt-20 bg-paper px-6 py-20 sm:px-10 sm:py-24 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          {ABOUT.heading}
        </h2>

        {/* Stats — top rectangle */}
        <div className={`mt-10 grid grid-cols-2 sm:grid-cols-4 ${cardClass}`}>
          {STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center justify-center gap-1.5 p-8 text-center sm:p-10"
            >
              <span className="font-display text-4xl font-bold leading-none tracking-tight text-ink sm:text-5xl">
                {s.value}
              </span>
              <span className="max-w-[18ch] text-sm leading-snug text-slate">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Rotating sponsors — middle rectangle */}
        <div className={`mt-6 ${cardClass} px-4 py-12 sm:px-10 sm:py-14`}>
          <SponsorReel />
          <p className="mt-8 text-center text-xs font-semibold uppercase tracking-[0.3em] text-slate">
            Previous Sponsors &amp; Partners
          </p>
        </div>

        {/* Location + map — bottom rectangle */}
        <div className={`mt-6 grid md:grid-cols-2 ${cardClass}`}>
          <a
            href={LOCATION.mapLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${EVENT.university} on the map`}
            className="relative block min-h-[260px] md:min-h-[320px]"
          >
            <iframe
              title={`Map of ${EVENT.university}`}
              src={LOCATION.mapSrc}
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ border: 0 }}
            />
          </a>

          {/* Vertically rotating location facts. */}
          <div className="flex flex-col items-center justify-center p-8 text-center sm:p-10">
            <VerticalRotator items={LOCATION.facts} />
          </div>
        </div>
      </div>
    </section>
  )
}
