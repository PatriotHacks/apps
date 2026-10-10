/**
 * Announcement bar. Sits above the nav inside the fixed header, so it stays
 * visible while scrolling. `/apply` is a same-origin 302 to the application
 * site (see vercel.json / netlify.toml), which keeps the printed and spoken
 * URL on patriothacks.org.
 */
export default function Banner() {
  return (
    <div className="bg-mason px-5 py-2 text-center text-[13px] font-medium leading-snug text-white sm:px-8 sm:text-sm">
      Applications are Open for Patriot Developers and Labs! Apply{' '}
      <a
        href="/apply"
        className="underline decoration-gold decoration-2 underline-offset-[3px] transition hover:text-gold focus-visible:outline-white"
      >
        here
      </a>
      .
    </div>
  )
}
