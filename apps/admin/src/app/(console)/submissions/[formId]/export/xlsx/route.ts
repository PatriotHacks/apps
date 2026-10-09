import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { staffClient } from "@/lib/db";
import { exportBatches, loadSubmissionExport, toSearchParams } from "@/lib/submission-export";

/**
 * The CSV export's columns as a workbook. Buffered, unlike the CSV: an `.xlsx`
 * is a zip whose directory is written last, so there is nothing to stream.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
): Promise<Response> {
  const { formId } = await params;
  const db = await staffClient();

  try {
    const setup = await loadSubmissionExport(db, formId, toSearchParams(new URL(request.url)));
    if (setup === null) return new Response("Form not found", { status: 404 });

    const data: SheetData = [setup.headers.map((value) => ({ value, fontWeight: "bold" }))];
    for await (const rows of exportBatches(db, setup)) {
      for (const row of rows) data.push(setup.cells(row));
    }

    const buffer = await writeXlsxFile(data, {
      sheet: "Submissions",
      stickyRowsCount: 1,
    }).toBuffer();
    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${setup.form.slug}-submissions-${stamp}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } finally {
    await db.end();
  }
}
