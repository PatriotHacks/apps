import { answers, profiles, submissionStatus, submissions } from "@patriothacks/database";
import { type Question, type QuestionType } from "@patriothacks/form-engine";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";

/**
 * The grid's URL state, and the SQL it compiles to.
 *
 * Everything here is server-side by construction: at 500-2000 submissions a
 * page that fetched every row to filter it in JavaScript would ship megabytes
 * per keystroke. Filters become `where` clauses, an answer filter becomes an
 * `exists` subquery against `answers` (which the
 * `answers(question_id, submission_id)` index serves), and paging is
 * `limit`/`offset` over the filtered set.
 */

export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];

export const SUBMISSION_STATUSES = submissionStatus.enumValues;

export const SORT_KEYS = ["submitted_at", "created_at", "updated_at", "email", "status"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type SortDirection = "asc" | "desc";

export const ANSWER_OPERATORS = ["contains", "eq", "answered", "blank"] as const;
export type AnswerOperator = (typeof ANSWER_OPERATORS)[number];

export interface AnswerFilter {
  questionId: string;
  operator: AnswerOperator;
  value: string;
}

export interface SubmissionQuery {
  statuses: SubmissionStatus[];
  /** Applicant email or name, substring match. */
  search: string;
  filters: AnswerFilter[];
  sort: SortKey;
  direction: SortDirection;
  /** 1-based. */
  page: number;
  perPage: number;
  /** Question ids to show as columns, or null for the default set. */
  columns: string[] | null;
}

export const PER_PAGE_CHOICES = [25, 50, 100] as const;
const DEFAULT_PER_PAGE = 50;

/** Question columns shown before anyone touches the picker. */
export const DEFAULT_COLUMN_COUNT = 4;

export type SearchParams = Record<string, string | string[] | undefined>;

const list = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Which operators a question type can answer.
 *
 * Grid and file answers are objects keyed by option id, so a substring match
 * over them would search ids rather than anything a reviewer typed. Offering
 * only presence for those is honest; offering `contains` would not be.
 */
export function operatorsFor(type: QuestionType): AnswerOperator[] {
  switch (type) {
    case "grid_multiple_choice":
    case "grid_checkbox":
    case "file_upload":
      return ["answered", "blank"];
    case "checkboxes":
      return ["eq", "answered", "blank"];
    default:
      return ["contains", "eq", "answered", "blank"];
  }
}

export function operatorLabel(type: QuestionType, operator: AnswerOperator): string {
  if (operator === "eq") return type === "checkboxes" ? "includes" : "is exactly";
  if (operator === "contains") return "contains";
  return operator === "answered" ? "is answered" : "is blank";
}

export const operatorNeedsValue = (operator: AnswerOperator) =>
  operator === "contains" || operator === "eq";

export function parseSubmissionQuery(
  params: SearchParams,
  questionIds: ReadonlySet<string>,
): SubmissionQuery {
  const statuses = list(params.status).filter((value): value is SubmissionStatus =>
    (SUBMISSION_STATUSES as readonly string[]).includes(value),
  );

  // Three index-aligned repeated params rather than one packed string, so the
  // filter rows are plain HTML inputs and a stale link cannot smuggle a
  // delimiter into a question id.
  const questionValues = list(params.fq);
  const operatorValues = list(params.fop);
  const valueValues = list(params.fv);

  const filters: AnswerFilter[] = [];
  for (const [index, questionId] of questionValues.entries()) {
    if (!questionIds.has(questionId)) continue;
    const operator = operatorValues[index];
    if (!(ANSWER_OPERATORS as readonly string[]).includes(operator ?? "")) continue;
    const value = (valueValues[index] ?? "").trim();
    if (operatorNeedsValue(operator as AnswerOperator) && value === "") continue;
    filters.push({ questionId, operator: operator as AnswerOperator, value });
  }

  const sortParam = first(params.sort);
  const sort = (SORT_KEYS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as SortKey)
    : "submitted_at";

  const perPageParam = Number(first(params.per));
  const perPage = (PER_PAGE_CHOICES as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;

  const pageParam = Number(first(params.page));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  // `colset` marks the picker as having been submitted, which is what lets
  // "show no question columns" differ from "never touched it".
  const columns =
    first(params.colset) === undefined
      ? null
      : list(params.col).filter((id) => questionIds.has(id));

  return {
    statuses,
    search: (first(params.q) ?? "").trim(),
    filters,
    sort,
    direction: first(params.dir) === "asc" ? "asc" : "desc",
    page,
    perPage,
    columns,
  };
}

/** The canonical serialization. Every link on the grid is built from this. */
export function submissionSearchParams(query: SubmissionQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const status of query.statuses) params.append("status", status);
  if (query.search !== "") params.set("q", query.search);
  for (const filter of query.filters) {
    params.append("fq", filter.questionId);
    params.append("fop", filter.operator);
    params.append("fv", filter.value);
  }
  params.set("sort", query.sort);
  params.set("dir", query.direction);
  if (query.perPage !== DEFAULT_PER_PAGE) params.set("per", String(query.perPage));
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.columns !== null) {
    params.set("colset", "1");
    for (const id of query.columns) params.append("col", id);
  }
  return params;
}

/** Which question columns to render, resolving the default. */
export function visibleColumnIds(query: SubmissionQuery, ordered: Question[]): string[] {
  if (query.columns !== null) return query.columns;
  return ordered.slice(0, DEFAULT_COLUMN_COUNT).map((question) => question.id);
}

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
