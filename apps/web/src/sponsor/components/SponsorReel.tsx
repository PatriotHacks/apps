import { REEL_SPONSORS } from '../config'

/**
 * The rotating past-sponsor logo reel (no wrapper/heading) — reused inside the
 * About rectangle. Two identical copies of the logo set slide by -50% via the
 * CSS `marquee` animation and loop seamlessly; each item carries its own right
 * margin (not a flex `gap`) so the last logo keeps trailing space. For the light
 * theme each logo is flattened to a black silhouette with a CSS filter, so the
 * mixed-color source art reads as one consistent set on white — except `raw`
 * logos (the recolored Salesforce cloud), which ship light-ready and render
 * as-is. Hover pauses it.
 */
export default function SponsorReel() {
  const reel = [...REEL_SPONSORS, ...REEL_SPONSORS]

  return (
    <div
      className="group relative overflow-hidden"
      style={{
        maskImage:
          'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
      }}
    >
      <div className="animate-marquee flex w-max items-center group-hover:[animation-play-state:paused]">
        {reel.map((s, i) => {
          const dup = i >= REEL_SPONSORS.length
          return (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={dup ? undefined : s.name}
              aria-hidden={dup || undefined}
              tabIndex={dup ? -1 : undefined}
              className="mr-12 flex shrink-0 items-center opacity-80 transition hover:opacity-100 sm:mr-16"
            >
              <img
                src={s.logo}
                alt={dup ? '' : s.name}
                className={`w-auto max-w-none object-contain ${
                  s.raw ? '' : '[filter:brightness(0)]'
                }`}
                style={{ maxHeight: `${38 * (s.scale ?? 1)}px` }}
              />
            </a>
          )
        })}
      </div>
    </div>
  )
}
