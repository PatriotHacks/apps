/* =====================================================================
 * PatriotHacks — site content & configuration
 * ---------------------------------------------------------------------
 * Almost everything you'll want to change lives in this one file:
 * the contact email, the signup endpoint, the sponsors, and the FAQ.
 * Components read from here, so you rarely need to touch JSX.
 * ===================================================================== */

/** Where "Questions? Reach out to …" and the footer point. */
export const CONTACT_EMAIL = 'patriothacksgmu@gmail.com'

/** The sponsorship prospectus page — where "Interested in Sponsoring?" goes. */
export const SPONSOR_PAGE_URL = '/sponsor'

/* ---------------------------------------------------------------------
 * "Interested?" — the two application forms.
 * ---------------------------------------------------------------------
 * Each card below links to its own page. The questions, copy, and
 * database table for each form live in src/forms/config.ts; this is only
 * the pitch shown on the home page.
 * ------------------------------------------------------------------- */
export type InterestCard = {
  title: string
  blurb: string
  cta: string
  href: string
}

export const INTEREST_CARDS: InterestCard[] = [
  {
    title: 'Volunteer',
    blurb:
      'Help run the weekend — check hackers in, keep the food and swag moving, and staff the help desk. No experience needed.',
    cta: 'Apply to volunteer',
    href: '/volunteer',
  },
  {
    title: 'Judge',
    blurb:
      'Spend a few hours meeting teams, watching demos, and helping pick the projects that stand out. Industry and academic judges welcome.',
    cta: 'Apply to judge',
    href: '/judge',
  },
]

/** Hero text. */
export const EVENT = {
  /** Shown in the hero, e.g. "Coming Spring 2027". */
  seasonLabel: 'Coming Spring 2027',
  /** University / host line above the wordmark. */
  eyebrow: 'George Mason University',
} as const

/* ---------------------------------------------------------------------
 * Interest-list email capture → private Google Sheet ("hidden database")
 * ---------------------------------------------------------------------
 * Every "Notify me" signup is POSTed to a Google Apps Script Web App
 * that appends the email + a timestamp to a Google Sheet only you can
 * see. That Sheet IS the hidden database. One-time setup:
 *
 *   1. Create a Google Sheet (this is your database). Optional: add a
 *      header row  ->  Timestamp | Email
 *   2. In that Sheet: Extensions → Apps Script. Delete the placeholder
 *      code and paste the contents of `apps-script/Code.gs` (in this
 *      repo). Save.
 *   3. Deploy → New deployment → gear icon → "Web app".
 *        • Execute as: Me
 *        • Who has access: Anyone
 *      Click Deploy, authorize, and copy the "Web app" URL — it looks
 *      like https://script.google.com/macros/s/AKfyc.../exec
 *   4. Paste that URL into SIGNUP_ENDPOINT below.
 *
 * Until it's set, the bar runs in demo mode (shows success, stores
 * nothing). No secrets live in this file — the endpoint URL is safe to
 * ship; only you can read the Sheet it writes to.
 * ------------------------------------------------------------------- */
export const SIGNUP_ENDPOINT = ''

export const isSignupConfigured = SIGNUP_ENDPOINT.length > 0

/* ---------------------------------------------------------------------
 * Sponsors
 * ---------------------------------------------------------------------
 * Previous sponsors shown as a rotating grid of logo tiles; clicking a
 * tile reveals the company's details in the panel beside the grid.
 *
 * `logo` is optional — until you add logo files, each tile shows the
 * company name as text. To add a logo, drop the file in /public/sponsors/
 * and set logo: '/sponsors/microsoft.svg'.
 * ------------------------------------------------------------------- */
export type Sponsor = {
  name: string
  /** Short blurb: what the company does. */
  description: string
  /** Optional path under /public, e.g. '/sponsors/microsoft.svg'. */
  logo?: string
  url?: string
  /**
   * Logo size multiplier (default 1). Bump square/compact logos up so they
   * read at the same visual size as the wide wordmark logos.
   */
  scale?: number
}

export const SPONSORS: Sponsor[] = [
  {
    name: 'Microsoft',
    description:
      'Global technology company behind Windows, the Azure cloud, Microsoft 365, and a broad portfolio of developer and AI tools.',
    logo: '/sponsors/microsoft.png',
    url: 'https://microsoft.com',
  },
  {
    name: 'AWS',
    description:
      "Amazon Web Services — the world's most broadly adopted cloud platform, offering compute, storage, databases, and AI services.",
    logo: '/sponsors/aws.png',
    scale: 1.5,
    url: 'https://aws.amazon.com',
  },
  {
    name: 'Palantir',
    description:
      'Software company building data integration and analytics platforms that help government and enterprise teams make decisions with their data.',
    logo: '/sponsors/palantir.png',
    url: 'https://palantir.com',
  },
  {
    name: 'Salesforce',
    description:
      'Cloud-based customer relationship management (CRM) platform powering sales, service, marketing, and app development for businesses worldwide.',
    logo: '/sponsors/salesforce.png',
    scale: 1.55,
    url: 'https://salesforce.com',
  },
  {
    name: 'MetroStar',
    description:
      'Digital services and IT modernization company delivering human-centered technology and AI solutions to U.S. federal agencies.',
    logo: '/sponsors/metrostar.png',
    scale: 1.35,
    url: 'https://metrostar.com',
  },
  {
    name: 'EY',
    description:
      'Ernst & Young — a global professional services organization providing assurance, tax, strategy, transactions, and consulting services.',
    logo: '/sponsors/ey.png',
    scale: 1.9,
    url: 'https://ey.com',
  },
  {
    name: 'Peraton',
    description:
      'National security and technology company delivering mission solutions across defense, space, intelligence, and cyber for the U.S. government.',
    logo: '/sponsors/peraton.png',
    url: 'https://peraton.com',
  },
  {
    name: 'Red Bull Basement',
    description:
      "Red Bull's global program empowering student innovators to turn early-stage ideas into real projects with mentorship and resources.",
    logo: '/sponsors/redbull.png',
    scale: 1.7,
    url: 'https://redbull.com/basement',
  },
  {
    name: 'Cloudforce',
    description:
      'Microsoft cloud solutions partner helping organizations modernize and scale with Azure, AI, and managed services.',
    logo: '/sponsors/cloudforce.png',
    url: 'https://gocloudforce.com',
  },
  {
    name: 'Department of Treasury',
    description:
      'The U.S. Department of the Treasury manages federal finances, produces currency, collects taxes, and shapes economic and financial policy.',
    logo: '/sponsors/treasury.png',
    scale: 2,
    url: 'https://home.treasury.gov',
  },
  {
    name: 'Fannie Mae',
    description:
      'Government-sponsored enterprise that supports the U.S. housing market by providing liquidity and stability to mortgage financing.',
    logo: '/sponsors/fannie-mae.png',
    url: 'https://fanniemae.com',
  },
  {
    name: 'GDIT',
    description:
      'General Dynamics Information Technology — a provider of IT, cyber, and mission services supporting U.S. government and defense agencies.',
    logo: '/sponsors/gdit.png',
    url: 'https://gdit.com',
  },
]

/* ---------------------------------------------------------------------
 * FAQ — edit freely. Answers accept plain text.
 * ------------------------------------------------------------------- */
export type FaqItem = { q: string; a: string }

export const FAQS: FaqItem[] = [
  {
    q: 'What is PatriotHacks?',
    a: "PatriotHacks is George Mason University's student hackathon — a weekend where students come together to build software and hardware projects from scratch, learn from mentors, and compete for prizes.",
  },
  {
    q: 'Who can participate?',
    a: 'All currently enrolled college and university students are welcome, regardless of major or experience level. First-time hackers are especially encouraged to join.',
  },
  {
    q: 'Do I need to know how to code?',
    a: 'Not at all. Beginners are welcome. Workshops and mentors will help you get started, and teams often include people with a mix of skills — design, business, and coding.',
  },
  {
    q: 'How much does it cost?',
    a: 'PatriotHacks is free to attend. Meals, swag, and workspace are provided throughout the event.',
  },
  {
    q: 'Do I need a team?',
    a: "You can come with a team of up to four, or join solo — we'll help you find teammates at the start of the event.",
  },
  {
    q: 'When and where is it?',
    a: 'PatriotHacks is coming Spring 2027 at George Mason University. Join the interest list above and we’ll email you the moment dates, venue, and registration go live.',
  },
  {
    q: 'How can I sponsor?',
    a: `We'd love to partner with you. Email us at ${CONTACT_EMAIL} and we'll share our sponsorship prospectus, tiers, and benefits — from recruiting access to branding and hosting workshops.`,
  },
]

/* ---------------------------------------------------------------------
 * Footer
 * ---------------------------------------------------------------------
 * Edit the links and address here. Social links with an empty href show
 * as greyed-out placeholder icons; fill in the href to make them live.
 * ------------------------------------------------------------------- */
export type SocialLink = {
  platform: 'instagram' | 'twitter' | 'facebook' | 'linkedin' | 'github'
  href: string
}

export const FOOTER = {
  /** MLH Code of Conduct (default is the official MLH link). */
  codeOfConductUrl: 'https://static.mlh.io/docs/mlh-code-of-conduct.pdf',
  /** Address lines, shown stacked. */
  address: ['George Mason University', 'Fairfax, VA 22030'],
  socials: [
    { platform: 'instagram', href: 'https://instagram.com/patriothacks' },
  ] as SocialLink[],
} as const
