/**
 * The catalogue of transactional templates. The words live in
 * `email_templates` and organizers edit them; what a key *means* and which
 * variables it may reference is code, because the send sites are the only
 * thing that can supply those values.
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

/** Anything renderable — a stored template or a broadcast body. */
export type MessageKey = TemplateKey | typeof BROADCAST_KEY;

export const MESSAGE_VARIABLES = {
  ...TEMPLATE_VARIABLES,
  [BROADCAST_KEY]: BROADCAST_VARIABLES,
} as const satisfies Record<MessageKey, readonly string[]>;

export type TemplateVariable = (typeof MESSAGE_VARIABLES)[MessageKey][number];

/** Every value a given key's placeholders can be filled from. */
export type TemplateContext<K extends MessageKey = MessageKey> = Record<
  (typeof MESSAGE_VARIABLES)[K][number],
  string
>;

export function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function variablesFor(key: MessageKey): readonly TemplateVariable[] {
  return MESSAGE_VARIABLES[key];
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
