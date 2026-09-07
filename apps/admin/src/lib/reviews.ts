import { profiles, submissionReviews } from "@patriothacks/database";
import { desc, eq } from "drizzle-orm";

import { requireStaff } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";
import { isUuid } from "@/lib/form-definition";

/**
 * Review notes are free-for-all: every organizer and admin reads all of them,
 * and each reviewer owns exactly one note per submission. There is no score and
 * no claim — the whole model is "what did you think", written down.
 */

export interface ReviewNote {
  reviewerId: string;
  reviewerEmail: string;
  reviewerName: string | null;
  notes: string;
  updatedAt: Date;
  /** Whether the signed-in reviewer wrote it. Presentation only; the write path re-checks. */
  mine: boolean;
}

export async function loadReviewNotes(submissionId: string): Promise<ReviewNote[]> {
  if (!isUuid(submissionId)) return [];

  const staff = await requireStaff();

  const rows = await queryAsStaff((tx) =>
    tx
      .select({
        reviewerId: submissionReviews.reviewerId,
        reviewerEmail: profiles.email,
        reviewerName: profiles.fullName,
        notes: submissionReviews.notes,
        updatedAt: submissionReviews.updatedAt,
      })
      .from(submissionReviews)
      .innerJoin(profiles, eq(profiles.id, submissionReviews.reviewerId))
      .where(eq(submissionReviews.submissionId, submissionId))
      .orderBy(desc(submissionReviews.updatedAt)),
  );

  return rows.map((row) => ({ ...row, mine: row.reviewerId === staff.userId }));
}
