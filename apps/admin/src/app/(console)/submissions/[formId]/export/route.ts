import { staffClient } from "@/lib/db";
import { exportBatches, loadSubmissionExport, toSearchParams } from "@/lib/submission-export";

/**
 * Streamed CSV of whatever the grid's current filter selects.
 *
 * Streamed rather than buffered because the ceiling is 2000 submissions of
 * long-form text: rows are pulled a batch at a time, and the next batch is only
 * fetched when the consumer has drained the last, so peak memory is one batch
 * regardless of how big the filter set is.
 */

/** Without it Excel opens a UTF-8 CSV as the local codepage and mangles names. */
const BOM = "﻿";

/** RFC 4180. Quote when the field contains a delimiter, a quote or a newline. */
const csvField = (value: string) =>
  /["\n\r,]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

const csvRow = (values: string[]) => `${values.map(csvField).join(",")}\r\n`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
): Promise<Response> {
  const { formId } = await params;
  const db = await staffClient();

  const setup = await loadSubmissionExport(
    db,
    formId,
    toSearchParams(new URL(request.url)),
  ).catch(async (error: unknown) => {
    await db.end();
    throw error;
  });

  if (setup === null) {
    await db.end();
    return new Response("Form not found", { status: 404 });
  }

  const batches = exportBatches(db, setup);
  const encoder = new TextEncoder();
  let finished = false;

  const finish = async (close: () => void) => {
    finished = true;
    close();
    await db.end();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(BOM + csvRow(setup.headers)));
    },

    async pull(controller) {
      if (finished) return;

      try {
        const next = await batches.next();
        if (next.done) {
          await finish(() => controller.close());
          return;
        }
        const chunk = next.value.map((row) => csvRow(setup.cells(row))).join("");
        controller.enqueue(encoder.encode(chunk));
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
      "content-disposition": `attachment; filename="${setup.form.slug}-submissions-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
