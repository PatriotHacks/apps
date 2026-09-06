"use server";

import { profiles, submissions } from "@patriothacks/database";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";
import { isDecisionStatus, isSettableStatus } from "@/lib/decisions";
import { isUuid, loadFormDefinition, orderedQuestions } from "@/lib/form-definition";
import { parseSubmissionQuery, type SearchParams } from "@/lib/submission-query";
import { submissionConditions } from "@/lib/submission-sql";

/**
 * Bulk decisions over the filter the grid is currently showing.
 *
 * The client sends the URL's query string, not a list of ids: the same
 * `parseSubmissionQuery` and `submissionConditions` the grid rendered from are
 * what compile the `where`, so the set updated is by construction the set the
 * admin was looking at. A tampered id list has nothing to tamper with.
 */

export type BulkStatusResult =
  | { status: "updated"; changed: number; skipped: number }
  | { status: "error"; message: string };

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Rebuilds the loose `searchParams` shape a page receives from a query string. */
function toSearchParams(search: string): SearchParams {
  const params: SearchParams = {};
  for (const key of new Set(new URLSearchParams(search).keys())) {
    const values = new URLSearchParams(search).getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }
  return params;
}

export async function setStatusForFilter(
  formId: string,
  search: string,
  status: string,
): Promise<BulkStatusResult> {
  const staff = await requireAdmin();
  if (!isUuid(formId)) return { status: "error", message: "Unknown form." };
  if (!isSettableStatus(status)) {
    return { status: "error", message: "That is not a status the console can set." };
  }

  try {
    const outcome = await queryAsStaff(async (tx): Promise<BulkStatusResult> => {
      const loaded = await loadFormDefinition(tx, formId);
      if (loaded === null) return { status: "error", message: "Unknown form." };

      const byId = new Map(orderedQuestions(loaded.definition).map((q) => [q.id, q]));
      const query = parseSubmissionQuery(toSearchParams(search), new Set(byId.keys()));
      const where = submissionConditions(formId, query, byId);

      const matching = tx
        .select({ id: submissions.id })
        .from(submissions)
        .innerJoin(profiles, eq(profiles.id, submissions.userId))
        .where(where);

      const [counted] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(submissions)
        .innerJoin(profiles, eq(profiles.id, submissions.userId))
        .where(where);
      const total = counted?.total ?? 0;

      const decided = isDecisionStatus(status);
      // A draft was never submitted and a withdrawal was taken back. Both can
      // sit inside the filter — the status facet offers them — and neither is
      // an application anyone is deciding, so they are left alone and counted.
      const changed = await tx
        .update(submissions)
        .set({
          status,
          decidedAt: decided ? new Date() : null,
          decidedBy: decided ? staff.userId : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(submissions.id, matching),
            notInArray(submissions.status, ["draft", "withdrawn"]),
          ),
        )
        .returning({ id: submissions.id });

      return { status: "updated", changed: changed.length, skipped: total - changed.length };
    });

    if (outcome.status === "updated") revalidatePath(`/forms/${formId}/submissions`);
    return outcome;
  } catch (cause) {
    return { status: "error", message: reason(cause) };
  }
}
