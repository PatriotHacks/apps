import DotField from './DotField'
import EmailSignup from './EmailSignup'

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col items-start justify-center overflow-hidden bg-paper px-6 pb-24 pt-36 text-left sm:px-10 sm:pt-40 lg:px-20"
    >
      <DotField />

      {/* Paper wash keeps the copy legible over the dot scenes.
          Mobile/tablet: a strong center band behind the full-width text
          (animation still peeks at top & bottom). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.95) 34%, rgba(255,255,255,0.95) 74%, rgba(255,255,255,0.5) 100%)',
        }}
      />
      {/* Desktop: left → right, so the scenes stay visible on the right. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            'linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.72) 28%, rgba(255,255,255,0.35) 48%, transparent 66%)',
        }}
      />

      <div className="animate-rise relative z-10 flex w-full max-w-xl flex-col items-start">
        {/* Wordmark */}
        <h1 className="font-display text-5xl font-bold leading-[0.9] tracking-tight text-ink sm:text-7xl">
          PatriotHacks
        </h1>

        {/* Tagline */}
        <p className="mt-6 max-w-lg text-base text-slate sm:text-lg">
          George Mason University's hackathon is coming Spring 2027. Drop your
          email and we'll keep you in the loop.
        </p>

        {/* Email capture */}
        <div id="notify" className="mt-5 w-full max-w-md scroll-mt-36">
          <EmailSignup />
        </div>
      </div>
    </section>
  )
}
