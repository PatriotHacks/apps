/**
 * The catalogue of transactional templates. The words live in
 * `email_templates` and organizers edit them; what a key *means* and which
 * variables it may reference is code, because the send sites are the only
 * thing that can supply those values.
 *
 * A key the catalogue does not declare is a template an admin built. Those are
 * restricted to the broadcast variables, which is the whole of the contract
 * below: it is what makes one always sendable from a broadcast.
 */

export const TEMPLATE_KEYS = [
  "decision_accepted",
  "decision_waitlisted",
  "decision_rejected",
  "rsvp_confirmed",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/**
 * Declared variables per key. The renderer resolves `{{name}}` against exactly
 * this list, the editor lists it, and saving a template that references
 * anything else is rejected.
 */
export const TEMPLATE_VARIABLES = {
  decision_accepted: ["full_name", "form_title", "year", "rsvp_url"],
  decision_waitlisted: ["full_name", "form_title", "year"],
  decision_rejected: ["full_name", "form_title", "year"],
  rsvp_confirmed: ["full_name", "form_title", "year"],
} as const satisfies Record<TemplateKey, readonly string[]>;

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  decision_accepted: "Decision — accepted",
  decision_waitlisted: "Decision — waitlisted",
  decision_rejected: "Decision — rejected",
  rsvp_confirmed: "RSVP confirmed",
};

/**
 * Broadcasts are not in `TEMPLATE_KEYS` on purpose: their words live on the
 * `broadcasts` row, not in `email_templates`, so they are not editable in the
 * template editor and never carry an `email_sends.template_key`. They still
 * render through the same interpolator, which is why they need a key here.
 */
export const BROADCAST_KEY = "broadcast";

export const BROADCAST_VARIABLES = ["full_name", "email", "year", "unsubscribe_url"] as const;

/**
 * The prefix every admin-built key carries. It is the whole of the collision
 * argument: no catalogue key may start with it, so a minted key cannot shadow a
 * present or future `TEMPLATE_KEYS` entry.
 */
export const CUSTOM_KEY_PREFIX = "custom_";

export type CustomTemplateKey = `${typeof CUSTOM_KEY_PREFIX}${string}`;

/** The keys the code knows by name, and the only ones `MESSAGE_VARIABLES` declares. */
export type DeclaredKey = TemplateKey | typeof BROADCAST_KEY;

/** Anything renderable — a stored template, an admin's own, or a broadcast body. */
export type MessageKey = DeclaredKey | CustomTemplateKey;

export const MESSAGE_VARIABLES = {
  ...TEMPLATE_VARIABLES,
  [BROADCAST_KEY]: BROADCAST_VARIABLES,
} as const satisfies Record<DeclaredKey, readonly string[]>;

export type TemplateVariable = (typeof MESSAGE_VARIABLES)[DeclaredKey][number];

/** What a key declares, at the type level. A custom key gets the broadcast set. */
export type VariablesOf<K extends MessageKey> = K extends DeclaredKey
  ? (typeof MESSAGE_VARIABLES)[K][number]
  : (typeof BROADCAST_VARIABLES)[number];

/** Every value a given key's placeholders can be filled from. */
export type TemplateContext<K extends MessageKey = MessageKey> = Record<VariablesOf<K>, string>;

export function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function isCustomTemplateKey(value: string): value is CustomTemplateKey {
  return value.startsWith(CUSTOM_KEY_PREFIX) && value.length > CUSTOM_KEY_PREFIX.length;
}

/**
 * A key minted from an admin's label: slugged, because `email_sends.template_key`
 * needs a stable token rather than prose, and prefixed, so the catalogue's
 * namespace stays the catalogue's. `null` when the label has nothing to slug —
 * the caller reports that rather than writing `custom_`.
 */
export function customTemplateKey(name: string): CustomTemplateKey | null {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");

  return slug.length > 0 ? `${CUSTOM_KEY_PREFIX}${slug}` : null;
}

/**
 * A custom template may reference only what a broadcast can supply. The built-in
 * keys reference `form_title` and `rsvp_url`, which no broadcast has, so this
 * restriction is exactly what makes an admin's template always sendable.
 */
export function variablesForCustom(): readonly TemplateVariable[] {
  return BROADCAST_VARIABLES;
}

export function variablesFor(key: MessageKey): readonly TemplateVariable[] {
  return isCustomTemplateKey(key) ? variablesForCustom() : MESSAGE_VARIABLES[key];
}

/** Stand-in values for the editor's test send, so nothing has to be invented per call site. */
export function sampleContext(key: MessageKey): TemplateContext {
  const samples: Record<TemplateVariable, string> = {
    full_name: "Ada Admin",
    email: "ada@example.com",
    form_title: "PatriotHacks Hacker Application",
    year: String(new Date().getUTCFullYear()),
    rsvp_url: "https://patriothacks.org/rsvp/sample",
    unsubscribe_url: "https://admin.patriothacks.org/unsubscribe?token=sample",
  };

  return Object.fromEntries(
    variablesFor(key).map((name) => [name, samples[name]]),
  ) as TemplateContext;
}
