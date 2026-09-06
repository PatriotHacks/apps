import type { rsvpStatus, submissionStatus } from "@patriothacks/database";

/**
 * What `broadcasts.audience_filter` holds, and what the builder edits.
 *
 * Stored as jsonb rather than resolved to a recipient list at compose time so
 * the definition stays inspectable after the fact: six months later "who got
 * this?" is answerable from the row itself, not reconstructed from guesses.
 *
 * Type-only against `@patriothacks/database` on purpose — the builder is a
 * client component, and one value import from the schema package pulls the
 * `pg` driver into the browser bundle.
 */

export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];
export type RsvpStatus = (typeof rsvpStatus.enumValues)[number];

/**
 * A draft is not an application, so it is never an audience. Every other
 * status is selectable; the omission is what makes "everyone who applied to
 * form X" mean what an organizer expects it to mean.
 */
export const AUDIENCE_STATUSES = [
  "submitted",
  "under_review",
  "accepted",
  "waitlisted",
  "rejected",
  "withdrawn",
] as const satisfies readonly SubmissionStatus[];

export const AUDIENCE_RSVP_STATUSES = [
  "pending",
  "confirmed",
  "declined",
] as const satisfies readonly RsvpStatus[];

/** The statuses an audience may name — `draft` is deliberately not one. */
export type AudienceStatus = (typeof AUDIENCE_STATUSES)[number];
export type AudienceRsvpStatus = (typeof AUDIENCE_RSVP_STATUSES)[number];

export const STATUS_LABELS: Record<AudienceStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const RSVP_LABELS: Record<AudienceRsvpStatus, string> = {
  pending: "RSVP pending",
  confirmed: "RSVP confirmed",
  declined: "RSVP declined",
};

export type AudienceFilter = {
  /** A single form, or null for every form. */
  formId: string | null;
  /** Empty means "any non-draft status". Otherwise an OR across the list. */
  statuses: AudienceStatus[];
  /** Empty means "any RSVP state, including none". Otherwise an OR. */
  rsvpStatuses: AudienceRsvpStatus[];
};

export const EMPTY_FILTER: AudienceFilter = { formId: null, statuses: [], rsvpStatuses: [] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const only = <T extends string>(allowed: readonly T[], value: unknown): T[] => {
  if (!Array.isArray(value)) return [];
  return allowed.filter((candidate) => value.includes(candidate));
};

/**
 * Narrows whatever came out of jsonb — or off a form post — to the shape the
 * SQL compiler accepts. Anything unrecognised is dropped rather than trusted;
 * a status string that reached the query unchecked would be a way to widen an
 * audience past what the console offers.
 */
export function parseAudienceFilter(value: unknown): AudienceFilter {
  if (typeof value !== "object" || value === null) return EMPTY_FILTER;

  const raw = value as Record<string, unknown>;
  const formId = typeof raw.formId === "string" && UUID.test(raw.formId) ? raw.formId : null;

  return {
    formId,
    statuses: only(AUDIENCE_STATUSES, raw.statuses),
    rsvpStatuses: only(AUDIENCE_RSVP_STATUSES, raw.rsvpStatuses),
  };
}

/** Plain English for the detail view and the send confirmation. */
export function describeAudience(filter: AudienceFilter, formTitle: string | null): string[] {
  const parts: string[] = [
    filter.formId ? `Applied to ${formTitle ?? "a form"}` : "Applied to any form",
  ];

  if (filter.statuses.length > 0) {
    parts.push(`Status: ${filter.statuses.map((s) => STATUS_LABELS[s]).join(", ")}`);
  }

  if (filter.rsvpStatuses.length > 0) {
    parts.push(`RSVP: ${filter.rsvpStatuses.map((s) => RSVP_LABELS[s]).join(", ")}`);
  }

  return parts;
}
