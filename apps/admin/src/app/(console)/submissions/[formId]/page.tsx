import { type Question } from "@patriothacks/form-engine";
import {
  Button,
  DataList,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@patriothacks/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmissionStatusBadge, submissionStatusLabel } from "@/components/submission-status-badge";
import { NOT_ASKED, summariseAnswer, viewAnswer } from "@/lib/answer-view";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import {
  PER_PAGE_CHOICES,
  SUBMISSION_STATUSES,
  submissionSearchParams,
  visibleColumnIds,
  type SearchParams,
  type SortKey,
  type SubmissionQuery,
} from "@/lib/submission-query";
import { loadSubmissionGrid, type SubmissionWithAnswers } from "@/lib/submissions";

import { AnswerFilterRows } from "./answer-filter-rows";
import { BulkStatus } from "./bulk-status";
import { filterableQuestion } from "./filterable-question";

/**
 * The response grid.
 *
 * Every control writes to the URL and the server re-runs the query: at
 * 500-2000 submissions the page can never hold the whole set, so pagination,
 * sorting and filtering all have to be `where`, `order by` and `limit` rather
 * than array methods. The filter form is a plain GET form for the same reason —
 * the URL is the state.
 */

function gridHref(base: string, query: SubmissionQuery, patch: Partial<SubmissionQuery>): string {
  const search = submissionSearchParams({ ...query, ...patch }).toString();
  return search === "" ? base : `${base}?${search}`;
}

function SortHeader({
  base,
  query,
  sortKey,
  children,
  className,
}: {
  base: string;
  query: SubmissionQuery;
  sortKey: SortKey;
  children: React.ReactNode;
  className?: string;
}) {
  const active = query.sort === sortKey;
  const next = active && query.direction === "desc" ? "asc" : "desc";

  return (
    <TableHead className={className}>
      <Link
        href={gridHref(base, query, { sort: sortKey, direction: next, page: 1 })}
        className="inline-flex items-center gap-1 hover:underline"
      >
        {children}
        <span aria-hidden="true" className="text-muted-foreground">
          {active ? (query.direction === "desc" ? "↓" : "↑") : ""}
        </span>
        {active ? <span className="sr-only">sorted {query.direction}ending</span> : null}
      </Link>
    </TableHead>
  );
}

/** A disabled anchor is still clickable, so the ends of the range render as buttons. */
function PageLink({
  href,
  enabled,
  children,
}: {
  href: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

/**
 * Long text truncates here on purpose. A grid is for triage; the detail view is
 * where an essay gets read.
 */
function AnswerCell({ question, row }: { question: Question; row: SubmissionWithAnswers }) {
  if (!row.reachable.has(question.id)) {
    return (
      <TableCell className="text-muted-foreground italic">
        <span title="This applicant's branch never reached this question">{NOT_ASKED}</span>
      </TableCell>
    );
  }

  const text = summariseAnswer(viewAnswer(question, row.answers[question.id]));
  if (text === "") return <TableCell className="text-muted-foreground">&mdash;</TableCell>;

  return (
    <TableCell>
      <span className="block max-w-72 truncate" title={text}>
        {text}
      </span>
    </TableCell>
  );
}

export default async function FormSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ formId }, rawParams] = await Promise.all([params, searchParams]);
  const [staff, grid] = await Promise.all([requireStaff(), loadSubmissionGrid(formId, rawParams)]);
  if (grid === null) notFound();

  const { form, questions, query, total, rows } = grid;
  const base = `/submissions/${form.id}`;
  const visibleIds = new Set(visibleColumnIds(query, questions));
  const columns = questions.filter((question) => visibleIds.has(question.id));

  const lastPage = Math.max(1, Math.ceil(total / query.perPage));
  const firstOnPage = total === 0 ? 0 : (query.page - 1) * query.perPage + 1;
  const lastOnPage = Math.min(query.page * query.perPage, total);

  const exportSearch = submissionSearchParams({ ...query, page: 1 }).toString();
  const filtered =
    query.search !== "" ||
    query.statuses.length > 0 ||
    query.filters.length > 0 ||
    query.columns !== null;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{form.title}</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "submission" : "submissions"} match this filter
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/forms/${form.id}`}>Form</Link>
          </Button>
          <Button asChild size="sm">
            <a href={`${base}/export?${exportSearch}`}>Export CSV</a>
          </Button>
        </div>
      </div>

      <form method="get" action={base} className="flex flex-col gap-4 rounded-lg border p-4">
        {/* Sorting and page size survive a filter change; the page number does
            not, because page 7 of the old filter means nothing under the new. */}
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="dir" value={query.direction} />

        {/* A phone cannot afford a screenful of filters above the data. Collapsed
            controls still submit, so nothing is lost while it is shut. */}
        <details
          open={filtered}
          className="md:[&>div]:flex md:[&::details-content]:[content-visibility:visible]"
        >
          <summary className="cursor-pointer text-sm font-medium md:hidden">Filters</summary>

          <div className="mt-4 flex flex-col gap-4 md:mt-0">
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Applicant</span>
                <Input
                  name="q"
                  defaultValue={query.search}
                  placeholder="Email or name"
                  className="w-64"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Per page</span>
                <Select name="per" defaultValue={query.perPage}>
                  {PER_PAGE_CHOICES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </label>

              <fieldset className="flex flex-col gap-1 text-sm">
                <legend className="font-medium">Status</legend>
                <div className="flex flex-wrap gap-3">
                  {SUBMISSION_STATUSES.map((status) => (
                    <label key={status} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        name="status"
                        value={status}
                        defaultChecked={query.statuses.includes(status)}
                        className="size-4 accent-primary"
                      />
                      {submissionStatusLabel(status)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <AnswerFilterRows
              questions={questions.map(filterableQuestion)}
              initial={query.filters}
            />

            <details open={query.columns !== null}>
              <summary className="cursor-pointer text-sm font-medium">
                Columns ({columns.length} of {questions.length} questions)
              </summary>
              {/* Presence of `colset` is what distinguishes an explicit empty
                  selection from never having opened this picker. */}
              <input type="hidden" name="colset" value="1" />
              <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:max-h-none sm:grid-cols-2 lg:grid-cols-3">
                {questions.map((question) => (
                  <label key={question.id} className="flex items-start gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name="col"
                      value={question.id}
                      defaultChecked={visibleIds.has(question.id)}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span>{question.label}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </details>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            Apply
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={base}>Reset</Link>
          </Button>
        </div>
      </form>

      {staff.role === "admin" ? (
        <BulkStatus formId={form.id} search={exportSearch} total={total} />
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground md:hidden">No submissions match this filter.</p>
      ) : null}

      {/* Triage on a phone is a list of applicants, not an 8-column grid: the
          card carries who they are, where they stand and enough of an answer to
          decide whether to open them. */}
      <DataList
        rows={rows}
        getKey={(row) => row.id}
        card={(row) => (
          <Link
            href={`${base}/${row.id}?${submissionSearchParams(query).toString()}`}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{row.fullName ?? row.email}</span>
              <SubmissionStatusBadge status={row.status} />
            </div>
            {row.fullName ? (
              <span className="text-xs break-all text-muted-foreground">{row.email}</span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Submitted {formatDateTime(row.submittedAt)}
            </span>
            {columns.slice(0, 2).map((question) => (
              <div key={question.id} className="flex flex-col">
                <span className="text-xs text-muted-foreground">{question.label}</span>
                <span className="line-clamp-2 text-sm">
                  {summariseAnswer(viewAnswer(question, row.answers[question.id]))}
                </span>
              </div>
            ))}
          </Link>
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader base={base} query={query} sortKey="email">
                Applicant
              </SortHeader>
              <SortHeader base={base} query={query} sortKey="status">
                Status
              </SortHeader>
              <SortHeader base={base} query={query} sortKey="submitted_at">
                Submitted
              </SortHeader>
              <SortHeader base={base} query={query} sortKey="updated_at">
                Updated
              </SortHeader>
              {columns.map((question) => (
                <TableHead key={question.id}>{question.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4 + columns.length} className="text-muted-foreground">
                  No submissions match this filter.
                </TableCell>
              </TableRow>
            ) : null}

            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    href={`${base}/${row.id}?${submissionSearchParams(query).toString()}`}
                    className="font-medium hover:underline"
                  >
                    {row.fullName ?? row.email}
                  </Link>
                  {row.fullName ? (
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <SubmissionStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(row.submittedAt)}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(row.updatedAt)}
                </TableCell>
                {columns.map((question) => (
                  <AnswerCell key={question.id} question={question} row={row} />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataList>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {total === 0 ? "No rows" : `Showing ${firstOnPage}–${lastOnPage} of ${total}`}
        </p>

        <div className="flex items-center gap-2">
          <PageLink href={gridHref(base, query, { page: query.page - 1 })} enabled={query.page > 1}>
            Previous
          </PageLink>
          <span className="text-muted-foreground">
            Page {query.page} of {lastPage}
          </span>
          <PageLink
            href={gridHref(base, query, { page: query.page + 1 })}
            enabled={query.page < lastPage}
          >
            Next
          </PageLink>
        </div>
      </div>
    </div>
  );
}
