import { type Question } from "@patriothacks/form-engine";
import { Badge, Button } from "@patriothacks/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmissionStatusBadge } from "@/components/submission-status-badge";
import { formatBytes, summariseAnswer, viewAnswer, type AnswerView } from "@/lib/answer-view";
import { orderedSections } from "@/lib/form-definition";
import { formatDateTime } from "@/lib/format";
import { submissionSearchParams, type SearchParams } from "@/lib/submission-query";
import { loadSubmissionDetail, type AnswerRevisionEntry } from "@/lib/submissions";

/**
 * One application as a document.
 *
 * Two things the grid cannot show: an essay at full length, and the shape of
 * the applicant's own path through the form. Branching leaves genuine holes, so
 * a section this applicant never saw is rendered as a section they never saw —
 * taken from `computeReachability`, never inferred from a missing answer, which
 * would be indistinguishable from a blank optional question.
 */

function AnswerBody({ view }: { view: AnswerView }) {
  switch (view.kind) {
    case "empty":
      return <p className="text-sm text-muted-foreground italic">No answer</p>;
    case "text":
      return <p className="text-sm whitespace-pre-wrap">{view.text}</p>;
    case "list":
      return (
        <ul className="list-inside list-disc text-sm">
          {view.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "grid":
      return (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          {view.rows.map((row) => (
            <div key={row.rowId} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "file":
      return (
        <p className="text-sm">
          {view.name}{" "}
          <span className="text-muted-foreground">({formatBytes(view.size)})</span>
        </p>
      );
    case "unreadable":
      return (
        <p className="text-sm text-destructive">
          Stored value does not match this question&apos;s type:{" "}
          <code className="font-mono text-xs">{view.raw}</code>
        </p>
      );
  }
}

function RevisionHistory({
  question,
  entries,
}: {
  question: Question;
  entries: AnswerRevisionEntry[];
}) {
  return (
    <details className="rounded-md border border-dashed p-3">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        Revision history ({entries.length})
      </summary>
      <ol className="mt-2 flex flex-col gap-2">
        {entries.map((entry) => {
          const previous = summariseAnswer(viewAnswer(question, entry.prevValue));
          return (
            <li key={entry.id} className="flex flex-col gap-1 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={entry.reason === "branch_discarded" ? "destructive" : "secondary"}>
                  {entry.reason === "branch_discarded" ? "branch discarded" : "edited"}
                </Badge>
                <span className="text-muted-foreground">{formatDateTime(entry.editedAt)}</span>
                {entry.editedByEmail ? (
                  <span className="text-muted-foreground">by {entry.editedByEmail}</span>
                ) : null}
              </div>
              <p className="text-muted-foreground">
                Was: {previous === "" ? "blank" : previous}
              </p>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, rawParams] = await Promise.all([params, searchParams]);
  const detail = await loadSubmissionDetail(id, rawParams);
  if (detail === null) notFound();

  const { form, definition, submission, answers, reachability, revisions, query, neighbours } =
    detail;

  const search = submissionSearchParams(query).toString();
  const gridHref = `/forms/${form.id}/submissions${search === "" ? "" : `?${search}`}`;
  const neighbourHref = (target: string) =>
    `/submissions/${target}${search === "" ? "" : `?${search}`}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={gridHref} className="text-sm text-muted-foreground hover:underline">
            ← {form.title}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{submission.fullName ?? submission.email}</h1>
            <SubmissionStatusBadge status={submission.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {submission.email} · submitted {formatDateTime(submission.submittedAt)} · last updated{" "}
            {formatDateTime(submission.updatedAt)}
          </p>
        </div>

        {/* Walking the pile without going back to the grid: the neighbours come
            from the same filtered, ordered set the grid showed. */}
        <div className="flex items-center gap-2">
          {neighbours?.previousId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={neighbourHref(neighbours.previousId)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {neighbours ? `${neighbours.position} of ${neighbours.total}` : "Not in this filter"}
          </span>
          {neighbours?.nextId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={neighbourHref(neighbours.nextId)}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      </div>

      <div className="flex max-w-3xl flex-col gap-6">
        {orderedSections(definition).map((section) => {
          const reached = reachability.sectionIds.has(section.id);
          const questions = [...section.questions].sort((a, b) => a.position - b.position);

          if (!reached) {
            return (
              <section
                key={section.id}
                className="rounded-lg border border-dashed bg-muted/30 p-4"
                aria-label={`${section.title}, not asked`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-muted-foreground">{section.title}</h2>
                  <Badge variant="outline">not asked</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  This applicant&apos;s answers branched around this section, so they were never
                  shown{" "}
                  {questions.length === 1 ? "this question" : `these ${questions.length} questions`}.
                  The blanks below are genuinely empty, not missing.
                </p>
                <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                  {questions.map((question) => (
                    <li key={question.id}>{question.label}</li>
                  ))}
                </ul>
              </section>
            );
          }

          return (
            <section key={section.id} className="flex flex-col gap-4">
              <div className="border-b pb-2">
                <h2 className="font-medium">{section.title}</h2>
                {section.description ? (
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                ) : null}
              </div>

              {questions.map((question) => {
                const entries = revisions.get(question.id) ?? [];
                return (
                  <div key={question.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-sm font-medium">{question.label}</h3>
                      {question.required ? <Badge variant="secondary">required</Badge> : null}
                    </div>
                    {question.helpText ? (
                      <p className="text-xs text-muted-foreground">{question.helpText}</p>
                    ) : null}
                    <AnswerBody view={viewAnswer(question, answers[question.id])} />
                    {entries.length > 0 ? (
                      <RevisionHistory question={question} entries={entries} />
                    ) : null}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
