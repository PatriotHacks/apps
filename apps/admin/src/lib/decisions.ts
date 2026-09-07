import { type TemplateKey } from "@patriothacks/emails";

import { type SubmissionStatus } from "@/lib/submission-query";

/**
 * The decision vocabulary, in one place so the detail view, the bulk control
 * and both server actions cannot disagree about what an admin may set.
 *
 * `draft`, `submitted` and `withdrawn` are the applicant's to set — the console
 * moves an application along the pipeline, it does not un-submit one.
 */

/** The three terminal outcomes. Setting one stamps `decided_at` and `decided_by`. */
export const DECISION_STATUSES = ["accepted", "waitlisted", "rejected"] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** Everything an admin may set, in pipeline order. */
export const SETTABLE_STATUSES = ["under_review", ...DECISION_STATUSES] as const;

export type SettableStatus = (typeof SETTABLE_STATUSES)[number];

export function isSettableStatus(value: string): value is SettableStatus {
  return (SETTABLE_STATUSES as readonly string[]).includes(value);
}

export function isDecisionStatus(value: SubmissionStatus): value is DecisionStatus {
  return (DECISION_STATUSES as readonly string[]).includes(value);
}

/**
 * A decision needs an application to decide on. A draft was never submitted and
 * a withdrawal was taken back, so neither is in the pile.
 */
export function isDecidable(status: SubmissionStatus): boolean {
  return status !== "draft" && status !== "withdrawn";
}

export const DECISION_TEMPLATE: Record<DecisionStatus, TemplateKey> = {
  accepted: "decision_accepted",
  waitlisted: "decision_waitlisted",
  rejected: "decision_rejected",
};

/**
 * Where an accepted applicant goes to RSVP. The admin app renders the link into
 * an email the platform app has to serve, so the origin has to be configured
 * rather than derived from the request.
 */
export function rsvpUrl(slug: string): string {
  const base = process.env.PLATFORM_URL;
  if (!base) throw new Error("PLATFORM_URL is not set");
  return `${base.replace(/\/+$/, "")}/${slug}/review`;
}
