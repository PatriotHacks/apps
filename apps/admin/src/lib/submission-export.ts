import { type DrizzleSupabaseClient, type Form } from "@patriothacks/database";
import { type FormDefinition, type Question } from "@patriothacks/form-engine";
import { type SQL } from "drizzle-orm";

import { exportCell, exportColumns } from "@/lib/answer-view";
import { loadFormDefinition, orderedQuestions } from "@/lib/form-definition";
import {
  parseSubmissionQuery,
  type SearchParams,
  type SubmissionQuery,
} from "@/lib/submission-query";
import { submissionConditions } from "@/lib/submission-sql";
import { readPage, type SubmissionWithAnswers } from "@/lib/submissions";

/**
 * What every export format shares: the grid's filter and order, the fixed
 * columns plus one per question (or per grid row), and a batched read.
 *
 * The two shapes worth care are both in `answer-view`: a grid question expands
 * to one column per grid row, and a question this applicant's branch never
 * reached exports as `(not asked)` rather than as a blank, which is what an
 * answered-but-empty optional question exports as.
 */

const BATCH_SIZE = 200;

export interface SubmissionExport {
  form: Form;
  definition: FormDefinition;
  questions: Question[];
  query: SubmissionQuery;
  where: SQL;
  headers: string[];
  cells: (row: SubmissionWithAnswers) => string[];
}

/** `URLSearchParams` collapses repeats; the filter rows depend on them. */
export function toSearchParams(url: URL): SearchParams {
  const params: SearchParams = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    params[key] = all.length > 1 ? all : all[0];
  }
  return params;
}

export async function loadSubmissionExport(
  db: DrizzleSupabaseClient,
  formId: string,
  params: SearchParams,
): Promise<SubmissionExport | null> {
  return db.rls(async (tx) => {
    const loaded = await loadFormDefinition(tx, formId);
    if (loaded === null) return null;

    const questions = orderedQuestions(loaded.definition);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const query = parseSubmissionQuery(params, new Set(byId.keys()));
    const columns = exportColumns(questions);

    return {
      form: loaded.form,
      definition: loaded.definition,
      questions,
      query,
      where: submissionConditions(formId, query, byId),
      headers: [
        "Submission ID",
        "Applicant",
        "Email",
        "Status",
        "Submitted at (UTC)",
        "Last updated (UTC)",
        ...columns.map((column) => column.header),
      ],
      cells: (row) => [
        row.id,
        row.fullName ?? "",
        row.email,
        row.status,
        row.submittedAt?.toISOString() ?? "",
        row.updatedAt.toISOString(),
        // `row.reachable` came from `computeReachability` over this
        // applicant's own answers -- the only thing that separates "never
        // asked" from "asked and left blank".
        ...columns.map((column) => {
          const question = byId.get(column.questionId);
          if (question === undefined) return "";
          return exportCell(
            question,
            column,
            row.answers[column.questionId],
            row.reachable.has(column.questionId),
          );
        }),
      ],
    };
  });
}

/**
 * The filtered set a batch at a time, each batch its own transaction. Lazy, so
 * a streamed consumer only fetches the next batch once it has drained the last.
 */
export async function* exportBatches(
  db: DrizzleSupabaseClient,
  setup: SubmissionExport,
): AsyncGenerator<SubmissionWithAnswers[]> {
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const rows = await db.rls((tx) =>
      readPage(tx, setup.definition, setup.where, setup.query, offset, BATCH_SIZE),
    );
    if (rows.length > 0) yield rows;
    if (rows.length < BATCH_SIZE) return;
  }
}
