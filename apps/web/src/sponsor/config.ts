/* =====================================================================
 * PatriotHacks — /sponsor page content & configuration
 * ---------------------------------------------------------------------
 * The sponsorship prospectus page. Everything a sponsor sees — the pitch,
 * the past-sponsor logos, and the benefits matrix — lives in this one
 * file. Components read from here, so you rarely touch JSX.
 *
 * Anything shared with the home page (contact email, footer links) is
 * re-exported from ../config so there is only one place to edit it.
 *
 * NOTE: the prices and benefits below are placeholders to get the layout
 * right. Replace them with your real prospectus figures before sharing
 * this with sponsors.
 * ===================================================================== */

export { CONTACT_EMAIL, FOOTER } from '../config'

/** Instagram — shown in the reach-out methods. `handle` renders as @handle. */
export const INSTAGRAM = {
  handle: 'patriothacks',
  url: 'https://instagram.com/patriothacks',
} as const

/**
 * Dedicated booking page — the "Book a meeting" buttons link here. It's a
 * standalone page (public/book.html) that embeds the Cal.com
 * scheduler and nothing else. To change the booking link, edit that file.
 */
export const BOOK_MEETING_URL = '/book'

export const EVENT = {
  /** Shown throughout the prospectus. */
  seasonLabel: 'Spring 2027',
  university: 'George Mason University',
  location: 'Fairfax, VA',
} as const

/* ---------------------------------------------------------------------
 * Hero
 * ------------------------------------------------------------------- */
export const HERO = {
  eyebrow: 'Sponsorship Prospectus · Spring 2027',
  title: 'Creating the next generation of builders and innovators',
  subtitle:
    "PatriotHacks is George Mason University's flagship student hackathon — a weekend where hundreds of students design, build, and ship. Your sponsorship fuels it, and puts you first in line for their talent.",
} as const

/* ---------------------------------------------------------------------
 * About section — the stats rectangle + the location / campus block.
 * ---------------------------------------------------------------------
 * STATS are placeholders/projections — swap in real figures. The location
 * `image` should live under public/campus/.
 * ------------------------------------------------------------------- */
export const ABOUT = {
  eyebrow: 'About',
  heading: 'A weekend of building at George Mason',
} as const

export type Stat = { value: string; label: string }

export const STATS: Stat[] = [
  { value: '800+', label: 'Expected hackers' },
  { value: '36', label: 'Hours to build' },
  { value: '40K+', label: 'Students at GMU' },
  { value: '#1', label: 'Largest university in Virginia' },
]

export const LOCATION = {
  /** Google Maps embed (no API key needed) — centered on GMU's Fairfax campus. */
  mapSrc: 'https://www.google.com/maps?q=38.8304,-77.3074&z=14&output=embed',
  /** Opens the full map in a new tab. */
  mapLink: 'https://www.google.com/maps/search/?api=1&query=George+Mason+University',
  /** Facts shown in the vertical rotator beside the map, cycling in order. */
  facts: [
    '20 minutes from Washington, D.C.',
    '2 hours from Richmond',
    '3 hours from Philadelphia',
    '4 hours from New York City',
    'Largest university in Virginia',
  ],
} as const

/* ---------------------------------------------------------------------
 * Past sponsors — the horizontal logo marquee.
 * ---------------------------------------------------------------------
 * Logos rotate in an infinite horizontal reel. Drop a logo file in
 * /public/sponsors/reel/ and reference it here. `scale` bumps square/compact
 * logos up so they read at the same visual size as wide wordmarks.
 *
 * These are the reel's own logo files — the home page's sponsor grid uses a
 * separate set under /public/sponsors/ (SPONSORS in ../config), because the
 * reel's art is prepared for the black-silhouette filter below.
 * ------------------------------------------------------------------- */
export type ReelSponsor = {
  name: string
  logo: string
  url?: string
  /** Logo size multiplier (default 1). */
  scale?: number
  /**
   * Skip the black-silhouette filter. The reel flattens every logo to a black
   * silhouette so the mixed-color source art reads as one set on white. Set
   * this for logos that already ship their own light-ready coloring and should
   * render as-is (e.g. the Salesforce cloud, recolored to a grey/black cloud
   * with white lettering — blackening it would swallow the white wordmark).
   */
  raw?: boolean
}

export const REEL_SPONSORS: ReelSponsor[] = [
  { name: 'Major League Hacking', logo: '/sponsors/reel/mlh.png', scale: 1.2, url: 'https://mlh.io' },
  { name: 'Microsoft', logo: '/sponsors/reel/microsoft.png', scale: 1.4, url: 'https://microsoft.com' },
  { name: 'AWS', logo: '/sponsors/reel/aws.png', scale: 1.5, url: 'https://aws.amazon.com' },
  { name: 'Palantir', logo: '/sponsors/reel/palantir.png', scale: 1.4, url: 'https://palantir.com' },
  { name: 'Salesforce', logo: '/sponsors/reel/salesforce.svg', scale: 1.5, raw: true, url: 'https://salesforce.com' },
  { name: 'MetroStar', logo: '/sponsors/reel/metrostar.png', scale: 1.4, url: 'https://metrostar.com' },
  { name: 'EY', logo: '/sponsors/reel/ey.png', scale: 1.9, url: 'https://ey.com' },
  { name: 'Peraton', logo: '/sponsors/reel/peraton.png', url: 'https://peraton.com' },
  { name: 'Red Bull Basement', logo: '/sponsors/reel/redbull.png', scale: 1.7, url: 'https://redbull.com/basement' },
  { name: 'Cloudforce', logo: '/sponsors/reel/cloudforce.png', url: 'https://gocloudforce.com' },
  { name: 'Department of Treasury', logo: '/sponsors/reel/treasury.png', scale: 2, url: 'https://home.treasury.gov' },
  { name: 'Fannie Mae', logo: '/sponsors/reel/fannie-mae.png', scale: 1.4, url: 'https://fanniemae.com' },
  { name: 'GDIT', logo: '/sponsors/reel/gdit.png', url: 'https://gdit.com' },
]

/* ---------------------------------------------------------------------
 * Tiers + benefits — the single source of truth for the comparison table.
 * ---------------------------------------------------------------------
 * TIERS defines the columns (name + price). BENEFITS defines the rows;
 * each benefit marks which tiers include it:
 *   true    → included (renders a checkmark)
 *   'text'  → included with a specific value (e.g. "3", "45 min")
 *   absent  → not included
 * ------------------------------------------------------------------- */
export const TIERS = [
  { key: 'bronze', name: 'Bronze', price: '$500' },
  { key: 'silver', name: 'Silver', price: '$1,500' },
  { key: 'gold', name: 'Gold', price: '$3,000', highlight: true },
  { key: 'platinum', name: 'Platinum', price: '$5,000' },
  { key: 'title', name: 'Title', price: '$10,000' },
] as const

export type TierKey = (typeof TIERS)[number]['key']

export type Benefit = {
  label: string
  detail?: string
  tiers: Partial<Record<TierKey, boolean | string>>
}

export const BENEFITS: Benefit[] = [
  {
    label: 'Logo on website & event signage',
    tiers: { bronze: true, silver: true, gold: true, platinum: true, title: true },
  },
  {
    label: 'Shout-out on social media',
    tiers: { bronze: true, silver: true, gold: true, platinum: true, title: true },
  },
  {
    label: 'Access to opt-in résumé book',
    tiers: { silver: true, gold: true, platinum: true, title: true },
  },
  {
    label: 'Logo on event T-shirt',
    tiers: { silver: 'Small', gold: 'Medium', platinum: 'Large', title: 'Prominent' },
  },
  {
    label: 'Recruiter table at the venue',
    tiers: { gold: true, platinum: true, title: true },
  },
  {
    label: 'Host a tech talk or workshop',
    tiers: { gold: '30 min', platinum: '45 min', title: '60 min' },
  },
  {
    label: 'Sponsored prize track',
    tiers: { platinum: '1 track', title: '2 tracks' },
  },
  {
    label: 'Send judges & mentors',
    tiers: { gold: '2', platinum: '4', title: 'Unlimited' },
  },
  {
    label: 'Opening-ceremony speaking slot',
    tiers: { title: true },
  },
  {
    label: 'Naming rights ("presented by …")',
    tiers: { title: true },
  },
]
