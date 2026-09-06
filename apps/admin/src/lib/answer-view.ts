import {
  choiceOptions,
  gridColumns,
  gridRows,
  parseAnswerValue,
  type Question,
} from "@patriothacks/form-engine";

/**
 * Turns a raw `answers.value` blob into something a reviewer can read.
 *
 * `answers.value` is jsonb with a different shape per question type, and choice
 * and grid answers store ids rather than labels, so nothing downstream can
 * render an answer without the question beside it. Everything the grid, the
 * detail view and the CSV export show goes through here so the three never
 * disagree about what an answer says.
 */

export type AnswerView =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "grid"; rows: { rowId: string; label: string; value: string }[] }
  | { kind: "file"; name: string; size: number }
  /** Stored blob does not satisfy its own type's schema. Shown, not hidden. */
  | { kind: "unreadable"; raw: string };

const BYTE_UNITS = ["bytes", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? size : Math.round(size * 10) / 10} ${BYTE_UNITS[unit]}`;
}

interface Labels {
  /** `choice` options are stored by `value`. */
  choice: Map<string, string>;
  /** Both grid axes are stored by option `id`. */
  gridRow: Map<string, string>;
  gridColumn: Map<string, string>;
}

// Keyed on the question object rather than its id: a request loads the form
// once, so this is warm for every row of the export without any plumbing, and
// it cannot leak across requests.
const LABEL_CACHE = new WeakMap<Question, Labels>();

function labelsFor(question: Question): Labels {
  const cached = LABEL_CACHE.get(question);
  if (cached) return cached;

  const labels: Labels = {
    choice: new Map(choiceOptions(question).map((o) => [o.value, o.label])),
    gridRow: new Map(gridRows(question).map((o) => [o.id, o.label])),
    gridColumn: new Map(gridColumns(question).map((o) => [o.id, o.label])),
  };
  LABEL_CACHE.set(question, labels);
  return labels;
}

const EMPTY: AnswerView = { kind: "empty" };

export function viewAnswer(question: Question, raw: unknown): AnswerView {
  if (raw === null || raw === undefined) return EMPTY;

  const parsed = parseAnswerValue(question.type, raw);
  if (!parsed.success) return { kind: "unreadable", raw: JSON.stringify(raw) };

  const labels = labelsFor(question);

  switch (question.type) {
    case "short_answer":
    case "paragraph":
    case "date":
    case "time": {
      const text = parsed.data as string;
      return text.trim() === "" ? EMPTY : { kind: "text", text };
    }
    case "multiple_choice":
    case "dropdown": {
      const value = parsed.data as string;
      if (value === "") return EMPTY;
      return { kind: "text", text: labels.choice.get(value) ?? value };
    }
    case "linear_scale":
      return { kind: "text", text: String(parsed.data as number) };
    case "checkboxes": {
      const values = parsed.data as string[];
      if (values.length === 0) return EMPTY;
      return { kind: "list", items: values.map((v) => labels.choice.get(v) ?? v) };
    }
    case "grid_multiple_choice": {
      const selection = parsed.data as Record<string, string>;
      const rows = gridRows(question)
        .map((row) => ({ row, columnId: selection[row.id] }))
        .filter((entry) => entry.columnId !== undefined)
        .map((entry) => ({
          rowId: entry.row.id,
          label: entry.row.label,
          value: labels.gridColumn.get(entry.columnId as string) ?? (entry.columnId as string),
        }));
      return rows.length === 0 ? EMPTY : { kind: "grid", rows };
    }
    case "grid_checkbox": {
      const selection = parsed.data as Record<string, string[]>;
      const rows = gridRows(question)
        .map((row) => ({
          rowId: row.id,
          label: row.label,
          value: (selection[row.id] ?? [])
            .map((columnId) => labels.gridColumn.get(columnId) ?? columnId)
            .join(", "),
        }))
        .filter((entry) => entry.value !== "");
      return rows.length === 0 ? EMPTY : { kind: "grid", rows };
    }
    case "file_upload": {
      const file = parsed.data as { name: string; size: number };
      return { kind: "file", name: file.name, size: file.size };
    }
  }
}

/** One line, for a grid cell or a revision entry. Never contains a newline. */
export function summariseAnswer(view: AnswerView): string {
  switch (view.kind) {
    case "empty":
      return "";
    case "text":
      return view.text.replaceAll(/\s+/g, " ").trim();
    case "list":
      return view.items.join(", ");
    case "grid":
      return view.rows.map((row) => `${row.label}: ${row.value}`).join("; ");
    case "file":
      return `${view.name} (${formatBytes(view.size)})`;
    case "unreadable":
      return view.raw;
  }
}

/**
 * A cell whose question this applicant's branch never reached. Genuinely empty
 * rather than missing, so it has to read differently from a blank optional
 * answer — which exports as an empty string.
 */
export const NOT_ASKED = "(not asked)";

/**
 * One CSV column per grid row rather than one per grid question: a grid holds
 * an answer per row, and collapsing them into a single cell would make the
 * column unsortable in a spreadsheet, which is the only reason to export at all.
 */
export interface ExportColumn {
  header: string;
  questionId: string;
  /** `question_options.id` of the grid row, or null for a flat question. */
  rowId: string | null;
}

export function exportColumns(questions: Question[]): ExportColumn[] {
  return questions.flatMap((question): ExportColumn[] => {
    const rows = gridRows(question);
    if (rows.length === 0) {
      return [{ header: question.label, questionId: question.id, rowId: null }];
    }
    return rows.map((row) => ({
      header: `${question.label} — ${row.label}`,
      questionId: question.id,
      rowId: row.id,
    }));
  });
}

/** The cell text for one export column. `reachable` is what decides "not asked". */
export function exportCell(
  question: Question,
  column: ExportColumn,
  raw: unknown,
  reachable: boolean,
): string {
  if (!reachable) return NOT_ASKED;
  const view = viewAnswer(question, raw);
  if (column.rowId === null) return summariseAnswer(view);
  if (view.kind !== "grid") return "";
  return view.rows.find((row) => row.rowId === column.rowId)?.value ?? "";
}
