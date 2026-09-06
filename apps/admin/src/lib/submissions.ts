import {
  answerRevisions,
  answers,
  profiles,
  submissions,
  type DatabaseTransaction,
  type Form,
} from "@patriothacks/database";
import {
  computeReachability,
  type FormDefinition,
  type Question,
  type Reachability,
} from "@patriothacks/form-engine";
import { desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { queryAsStaff } from "@/lib/db";
import { isUuid, loadFormDefinition, orderedQuestions } from "@/lib/form-definition";
import {
  parseSubmissionQuery,
  submissionConditions,
  submissionOrderBy,
  type SearchParams,
  type SubmissionQuery,
  type SubmissionStatus,
} from "@/lib/submission-query";

/**
 * Reads behind the response grid, the detail view and the export.
 *
 * The shape of every one of them is the same: paginate `submissions` with the
 * filters applied, fetch the `answers` for that page's ids in one query, and
 * pivot in JavaScript. No SQL pivot — a 13-column crosstab is unreadable, and
 * a form with 60 questions would generate one no planner enjoys.
 */

export interface SubmissionRow {
  id: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  fullName: string | null;
}

export interface SubmissionWithAnswers extends SubmissionRow {
  answers: Record<string, unknown>;
  /** Question ids this applicant's own branch actually reached. */
  reachable: ReadonlySet<string>;
}

const ROW_COLUMNS = {
  id: submissions.id,
  status: submissions.status,
  submittedAt: submissions.submittedAt,
  createdAt: submissions.createdAt,
  updatedAt: submissions.updatedAt,
  email: profiles.email,
  fullName: profiles.fullName,
} as const;

function countRows(tx: DatabaseTransaction, where: SQL) {
  return tx
    .select({ total: sql<number>`count(*)::int` })
    .from(submissions)
    .innerJoin(profiles, eq(profiles.id, submissions.userId))
    .where(where);
}

/** One page of submissions plus their answers, pivoted and reachability-tagged. */
export async function readPage(
  tx: DatabaseTransaction,
  definition: FormDefinition,
  where: SQL,
  query: SubmissionQuery,
  offset: number,
  limit: number,
): Promise<SubmissionWithAnswers[]> {
  const rows = await tx
    .select(ROW_COLUMNS)
    .from(submissions)
    .innerJoin(profiles, eq(profiles.id, submissions.userId))
    .where(where)
    .orderBy(submissionOrderBy(query))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) return [];

  const answerRows = await tx
    .select({
      submissionId: answers.submissionId,
      questionId: answers.questionId,
      value: answers.value,
    })
    .from(answers)
    .where(
      inArray(
        answers.submissionId,
        rows.map((row) => row.id),
      ),
    );

  const bySubmission = new Map<string, Record<string, unknown>>();
  for (const row of answerRows) {
    const bucket = bySubmission.get(row.submissionId) ?? {};
    bucket[row.questionId] = row.value;
    bySubmission.set(row.submissionId, bucket);
  }

  return rows.map((row) => {
    const values = bySubmission.get(row.id) ?? {};
    return {
      ...row,
      answers: values,
      reachable: computeReachability(definition, values).questionIds,
    };
  });
}

export interface SubmissionGrid {
  form: Form;
  definition: FormDefinition;
  questions: Question[];
  query: SubmissionQuery;
  total: number;
  rows: SubmissionWithAnswers[];
}

export async function loadSubmissionGrid(
  formId: string,
  params: SearchParams,
): Promise<SubmissionGrid | null> {
  return queryAsStaff(async (tx) => {
    const loaded = await loadFormDefinition(tx, formId);
    if (loaded === null) return null;

    const questions = orderedQuestions(loaded.definition);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const query = parseSubmissionQuery(params, new Set(byId.keys()));
    const where = submissionConditions(formId, query, byId);

    const [count] = await countRows(tx, where);
    const total = count?.total ?? 0;

    const rows = await readPage(
      tx,
      loaded.definition,
      where,
      query,
      (query.page - 1) * query.perPage,
      query.perPage,
    );

    return { form: loaded.form, definition: loaded.definition, questions, query, total, rows };
  });
}

export interface SubmissionNeighbours {
  previousId: string | null;
  nextId: string | null;
  /** 1-based place in the filtered set, for "12 of 512". */
  position: number;
  total: number;
}

/**
 * Where this submission sits in the filtered set, and what surrounds it.
 *
 * A window function rather than fetching the id list and searching it: the pile
 * is 500-2000 rows and only three values ever leave the database.
 */
async function readNeighbours(
  tx: DatabaseTransaction,
  submissionId: string,
  where: SQL,
  query: SubmissionQuery,
): Promise<SubmissionNeighbours | null> {
  const order = submissionOrderBy(query);

  const ordered = tx.$with("ordered").as(
    tx
      .select({
        id: submissions.id,
        previousId: sql<string | null>`lag(${submissions.id}) over (order by ${order})`.as(
          "previous_id",
        ),
        nextId: sql<string | null>`lead(${submissions.id}) over (order by ${order})`.as("next_id"),
        position: sql<number>`(row_number() over (order by ${order}))::int`.as("position"),
        total: sql<number>`(count(*) over ())::int`.as("total"),
      })
      .from(submissions)
      .innerJoin(profiles, eq(profiles.id, submissions.userId))
      .where(where),
  );

  const [row] = await tx
    .with(ordered)
    .select({
      previousId: ordered.previousId,
      nextId: ordered.nextId,
      position: ordered.position,
      total: ordered.total,
    })
    .from(ordered)
    .where(eq(ordered.id, submissionId));

  return row ?? null;
}

export interface AnswerRevisionEntry {
  id: string;
  questionId: string;
  prevValue: unknown;
  reason: "edit" | "branch_discarded";
  editedAt: Date;
  editedByEmail: string | null;
}

export interface SubmissionDetail {
  form: Form;
  definition: FormDefinition;
  submission: SubmissionRow;
  answers: Record<string, unknown>;
  reachability: Reachability;
  revisions: Map<string, AnswerRevisionEntry[]>;
  query: SubmissionQuery;
  neighbours: SubmissionNeighbours | null;
}

export async function loadSubmissionDetail(
  submissionId: string,
  params: SearchParams,
): Promise<SubmissionDetail | null> {
  if (!isUuid(submissionId)) return null;

  return queryAsStaff(async (tx) => {
    const [submission] = await tx
      .select({ ...ROW_COLUMNS, formId: submissions.formId })
      .from(submissions)
      .innerJoin(profiles, eq(profiles.id, submissions.userId))
      .where(eq(submissions.id, submissionId))
      .limit(1);
    if (!submission) return null;

    const loaded = await loadFormDefinition(tx, submission.formId);
    if (loaded === null) return null;

    const questions = orderedQuestions(loaded.definition);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const query = parseSubmissionQuery(params, new Set(byId.keys()));

    const answerRows = await tx
      .select({ questionId: answers.questionId, value: answers.value })
      .from(answers)
      .where(eq(answers.submissionId, submissionId));

    const values = Object.fromEntries(answerRows.map((row) => [row.questionId, row.value]));

    // Left join: `edited_by` is null for a row written before the actor was
    // known, and set null when the editor's profile is deleted.
    const revisionRows = await tx
      .select({
        id: answerRevisions.id,
        questionId: answerRevisions.questionId,
        prevValue: answerRevisions.prevValue,
        reason: answerRevisions.reason,
        editedAt: answerRevisions.editedAt,
        editedByEmail: profiles.email,
      })
      .from(answerRevisions)
      .leftJoin(profiles, eq(profiles.id, answerRevisions.editedBy))
      .where(eq(answerRevisions.submissionId, submissionId))
      .orderBy(desc(answerRevisions.editedAt));

    const revisions = new Map<string, AnswerRevisionEntry[]>();
    for (const row of revisionRows) {
      const bucket = revisions.get(row.questionId) ?? [];
      bucket.push(row);
      revisions.set(row.questionId, bucket);
    }

    const neighbours = await readNeighbours(
      tx,
      submissionId,
      submissionConditions(submission.formId, query, byId),
      query,
    );

    return {
      form: loaded.form,
      definition: loaded.definition,
      submission,
      answers: values,
      reachability: computeReachability(loaded.definition, values),
      revisions,
      query,
      neighbours,
    };
  });
}

export { countRows };
