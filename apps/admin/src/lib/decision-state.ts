import { emailSends, profiles, submissions } from "@patriothacks/database";
import { TEMPLATE_KEYS, type TemplateKey } from "@patriothacks/emails";
import { aliasedTable, and, desc, eq, inArray } from "drizzle-orm";

import { queryAsStaff } from "@/lib/db";
import { isUuid } from "@/lib/form-definition";

/**
 * What the decision panel needs and the grid never loads: who decided and when,
 * where the applicant's RSVP stands, and what happened the last time each
 * notice was mailed.
 *
 * Read separately from `loadSubmissionDetail` on purpose — the grid shares that
 * loader's row shape, and three columns only the detail view uses do not belong
 * in every page of 100 rows.
 */

export type EmailAttemptStatus = (typeof emailSends.status.enumValues)[number];

export interface EmailAttempt {
  status: EmailAttemptStatus;
  error: string | null;
  createdAt: Date;
}

export interface DecisionState {
  decidedAt: Date | null;
  decidedByEmail: string | null;
  rsvpStatus: "pending" | "confirmed" | "declined" | null;
  rsvpAt: Date | null;
  /** Latest attempt per template key, sent or failed. */
  sends: Map<TemplateKey, EmailAttempt>;
}

const decider = aliasedTable(profiles, "decider");

export async function loadDecisionState(submissionId: string): Promise<DecisionState | null> {
  if (!isUuid(submissionId)) return null;

  return queryAsStaff(async (tx) => {
    const [row] = await tx
      .select({
        applicantId: submissions.userId,
        decidedAt: submissions.decidedAt,
        decidedByEmail: decider.email,
        rsvpStatus: submissions.rsvpStatus,
        rsvpAt: submissions.rsvpAt,
      })
      .from(submissions)
      .leftJoin(decider, eq(decider.id, submissions.decidedBy))
      .where(eq(submissions.id, submissionId))
      .limit(1);
    if (!row) return null;

    // `email_sends` carries a row whether the provider accepted the message or
    // refused it. Reading it back is what keeps a failed decision notice
    // findable tomorrow rather than only in the toast that announced it.
    const attempts = await tx
      .select({
        templateKey: emailSends.templateKey,
        status: emailSends.status,
        error: emailSends.error,
        createdAt: emailSends.createdAt,
      })
      .from(emailSends)
      .where(
        and(
          eq(emailSends.toUserId, row.applicantId),
          inArray(emailSends.templateKey, [...TEMPLATE_KEYS]),
        ),
      )
      .orderBy(desc(emailSends.createdAt));

    const sends = new Map<TemplateKey, EmailAttempt>();
    for (const attempt of attempts) {
      const key = attempt.templateKey as TemplateKey;
      if (!sends.has(key)) {
        sends.set(key, {
          status: attempt.status,
          error: attempt.error,
          createdAt: attempt.createdAt,
        });
      }
    }

    const { applicantId: _applicantId, ...state } = row;
    return { ...state, sends };
  });
}
