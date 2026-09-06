import { exportCell, exportColumns } from "@/lib/answer-view";
import { staffClient } from "@/lib/db";
import { loadFormDefinition, orderedQuestions } from "@/lib/form-definition";
import { parseSubmissionQuery, type SearchParams } from "@/lib/submission-query";
import { submissionConditions } from "@/lib/submission-sql";
import { readPage } from "@/lib/submissions";

/**
 * Streamed CSV of whatever the grid's current filter selects.
 *
 * Streamed rather than buffered because the ceiling is 2000 submissions of
 * long-form text and a Worker's memory is not: rows are pulled a batch at a
 * time, and the next batch is only fetched when the consumer has drained the
 * last, so peak memory is one batch regardless of how big the filter set is.
 *
 * The two shapes worth care are both in `answer-view`: a grid question expands
 * to one column per grid row, and a question this applicant's branch never
 * reached exports as `(not asked)` rather than as a blank, which is what an
 * answered-but-empty optional question exports as.
 */

const BATCH_SIZE = 200;

/** Without it Excel opens a UTF-8 CSV as the local codepage and mangles names. */
const BOM = "\uFEFF";

/** RFC 4180. Quote when the field contains a delimiter, a quote or a newline. */
const csvField = (value: string) =>
  /["\n\r,]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

const csvRow = (values: string[]) => `${values.map(csvField).join(",")}\r\n`;

/** `URLSearchParams` collapses repeats; the filter rows depend on them. */
function toSearchParams(url: URL): SearchParams {
  const params: SearchParams = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    params[key] = all.length > 1 ? all : all[0];
  }
  return params;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const db = await staffClient();

  const setup = await db
    .rls(async (tx) => {
      const loaded = await loadFormDefinition(tx, id);
      if (loaded === null) return null;

      const questions = orderedQuestions(loaded.definition);
      const byId = new Map(questions.map((question) => [question.id, question]));
      const query = parseSubmissionQuery(toSearchParams(new URL(request.url)), new Set(byId.keys()));

      return {
        form: loaded.form,
        definition: loaded.definition,
        questions,
        query,
        where: submissionConditions(id, query, byId),
      };
    })
    .catch(async (error: unknown) => {
      await db.end();
      throw error;
    });

  if (setup === null) {
    await db.end();
    return new Response("Form not found", { status: 404 });
  }

  const { form, definition, questions, query, where } = setup;
  const columns = exportColumns(questions);
  const byId = new Map(questions.map((question) => [question.id, question]));
  const encoder = new TextEncoder();

  let offset = 0;
  let finished = false;

  const finish = async (close: () => void) => {
    finished = true;
    close();
    await db.end();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          BOM +
            csvRow([
              "Submission ID",
              "Applicant",
              "Email",
              "Status",
              "Submitted at (UTC)",
              "Last updated (UTC)",
              ...columns.map((column) => column.header),
            ]),
        ),
      );
    },

    async pull(controller) {
      if (finished) return;

      try {
        const rows = await db.rls((tx) =>
          readPage(tx, definition, where, query, offset, BATCH_SIZE),
        );
        offset += rows.length;

        if (rows.length === 0) {
          await finish(() => controller.close());
          return;
        }

        let chunk = "";
        for (const row of rows) {
          chunk += csvRow([
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
          ]);
        }
        controller.enqueue(encoder.encode(chunk));

        if (rows.length < BATCH_SIZE) await finish(() => controller.close());
      } catch (error) {
        await finish(() => controller.error(error));
      }
    },

    async cancel() {
      finished = true;
      await db.end();
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${form.slug}-submissions-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
