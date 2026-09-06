import type { submissionStatus } from "@patriothacks/database";
import type { Question, QuestionType } from "@patriothacks/form-engine";

/**
 * The grid's URL state: what a search param means, and how it round-trips.
 *
 * Deliberately free of any runtime import from `@patriothacks/database` — the
 * filter rows are a client component, and one value import from the schema
 * package pulls the `pg` driver into the browser bundle. The SQL these
 * describe is compiled in `submission-sql`, which never reaches the client.
 */

export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];

/**
 * Spelled out rather than read off `submissionStatus.enumValues` so this module
 * stays type-only against the schema. The assertion below fails to compile if
 * the two ever drift.
 */
export const SUBMISSION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "waitlisted",
  "rejected",
  "withdrawn",
] as const satisfies readonly SubmissionStatus[];

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const _statusesAreExhaustive: Exact<
  SubmissionStatus,
  (typeof SUBMISSION_STATUSES)[number]
> = true;
void _statusesAreExhaustive;

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
