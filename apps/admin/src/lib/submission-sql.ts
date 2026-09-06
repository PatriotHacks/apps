import { answers, profiles, submissions } from "@patriothacks/database";
import type { Question } from "@patriothacks/form-engine";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";

import type { AnswerFilter, SubmissionQuery } from "@/lib/submission-query";

/**
 * What the grid's URL state compiles to.
 *
 * Everything is server-side by construction: at 500-2000 submissions a page
 * that fetched every row to filter it in JavaScript would ship megabytes per
 * keystroke. Filters become `where` clauses, an answer filter becomes an
 * `exists` subquery against `answers` — which the
 * `answers(question_id, submission_id)` index serves — and paging is
 * `limit`/`offset` over the filtered set.
 */

const escapeLike = (value: string) => value.replaceAll(/[\\%_]/g, (match) => `\\${match}`);

/**
 * `#>> '{}'` renders a jsonb scalar as text with the quotes stripped, so one
 * expression covers every type that stores a bare string or number.
 */
const asText = sql`(${answers.value} #>> '{}')`;

/** What "answered" means in SQL: a row exists and it is not an empty shape. */
const nonEmpty = sql`${answers.value} is not null
    and ${answers.value} <> 'null'::jsonb
    and ${answers.value} <> '""'::jsonb
    and ${answers.value} <> '[]'::jsonb
    and ${answers.value} <> '{}'::jsonb`;

function answerPredicate(question: Question, filter: AnswerFilter): SQL {
  if (filter.operator === "answered" || filter.operator === "blank") return nonEmpty;

  if (question.type === "checkboxes") {
    // Containment against the stored array, so `@>` uses the jsonb operator
    // rather than a text scan over the serialized list.
    return sql`${answers.value} @> ${JSON.stringify([filter.value])}::jsonb`;
  }

  if (filter.operator === "eq") return sql`${asText} = ${filter.value}`;
  return sql`${asText} ilike ${`%${escapeLike(filter.value)}%`}`;
}

/** The `exists` subquery a single answer filter compiles to. */
function answerCondition(question: Question, filter: AnswerFilter): SQL {
  const inner = sql`select 1 from ${answers}
  where ${answers.submissionId} = ${submissions.id}
    and ${answers.questionId} = ${filter.questionId}
    and ${answerPredicate(question, filter)}`;

  return filter.operator === "blank" ? sql`not exists (${inner})` : sql`exists (${inner})`;
}

/**
 * The full `where` for the grid, the count, the export and the previous/next
 * lookup. One definition, so a row the grid shows is a row the export writes.
 */
export function submissionConditions(
  formId: string,
  query: SubmissionQuery,
  byId: ReadonlyMap<string, Question>,
): SQL {
  const conditions: SQL[] = [eq(submissions.formId, formId)];

  if (query.statuses.length > 0) {
    conditions.push(inArray(submissions.status, query.statuses));
  }

  if (query.search !== "") {
    const pattern = `%${escapeLike(query.search)}%`;
    conditions.push(
      or(
        sql`${profiles.email} ilike ${pattern}`,
        sql`${profiles.fullName} ilike ${pattern}`,
      ) as SQL,
    );
  }

  for (const filter of query.filters) {
    const question = byId.get(filter.questionId);
    if (question) conditions.push(answerCondition(question, filter));
  }

  return and(...conditions) as SQL;
}

const SORT_COLUMNS = {
  submitted_at: submissions.submittedAt,
  created_at: submissions.createdAt,
  updated_at: submissions.updatedAt,
  email: profiles.email,
  status: submissions.status,
} as const;

/**
 * `nulls last` in both directions: a draft has no `submitted_at`, and the
 * useful reading of "newest first" puts the unsubmitted at the bottom rather
 * than at the top, which is where Postgres puts nulls on a plain `desc`.
 * The id tiebreak is what makes paging stable across requests.
 */
export function submissionOrderBy(query: SubmissionQuery): SQL {
  const direction = sql.raw(query.direction);
  return sql`${SORT_COLUMNS[query.sort]} ${direction} nulls last, ${submissions.id} ${direction}`;
}
