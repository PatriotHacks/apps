import { type Question } from "@patriothacks/form-engine";
import { notFound } from "next/navigation";

import { submissionStatusLabel } from "@/components/submission-status-badge";
import { NOT_ASKED, summariseAnswer, viewAnswer } from "@/lib/answer-view";
import { staffClient } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  exportBatches,
  loadSubmissionExport,
  type SubmissionExport,
} from "@/lib/submission-export";
import { type SearchParams } from "@/lib/submission-query";
import { type SubmissionWithAnswers } from "@/lib/submissions";

import { PrintOnLoad } from "./print-on-load";

/**
 * The PDF export: the grid's filtered set, one submission per printed page, for
 * the browser's Save as PDF. Fixed light colours so a dark-theme session still
 * prints black on white.
 */

function answerText(question: Question, row: SubmissionWithAnswers): string {
  if (!row.reachable.has(question.id)) return NOT_ASKED;
  const view = viewAnswer(question, row.answers[question.id]);
  return view.kind === "text" ? view.text : summariseAnswer(view);
}

export default async function SubmissionsPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ formId }, rawParams] = await Promise.all([params, searchParams]);
  const db = await staffClient();

  let setup: SubmissionExport | null;
  const rows: SubmissionWithAnswers[] = [];
  try {
    setup = await loadSubmissionExport(db, formId, rawParams);
    if (setup !== null) {
      for await (const batch of exportBatches(db, setup)) rows.push(...batch);
    }
  } finally {
    await db.end();
  }
  if (setup === null) notFound();

  return (
    <div className="bg-white p-6 text-neutral-900 print:p-0">
      <PrintOnLoad />
      <p className="mb-6 text-sm text-neutral-600 print:hidden">
        {setup.form.title}: {rows.length} {rows.length === 1 ? "submission" : "submissions"}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm">No submissions match this filter.</p>
      ) : null}

      {rows.map((row) => (
        <article key={row.id} className="mb-10 break-after-page last:break-after-auto print:mb-0">
          <header className="mb-4 border-b border-neutral-300 pb-3">
            <h1 className="text-lg font-semibold">{row.fullName ?? row.email}</h1>
            <p className="text-sm text-neutral-600">{row.email}</p>
            <p className="text-sm text-neutral-600">
              {submissionStatusLabel(row.status)} · submitted {formatDateTime(row.submittedAt)} ·
              last updated {formatDateTime(row.updatedAt)}
            </p>
          </header>

          <dl className="flex flex-col gap-3">
            {setup.questions.map((question) => {
              const text = answerText(question, row);
              return (
                <div key={question.id} className="break-inside-avoid">
                  <dt className="text-sm font-medium">{question.label}</dt>
                  <dd className="text-sm whitespace-pre-wrap">
                    {text === "" ? <span className="text-neutral-500">&mdash;</span> : text}
                  </dd>
                </div>
              );
            })}
          </dl>
        </article>
      ))}
    </div>
  );
}
