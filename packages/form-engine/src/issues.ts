/**
 * Structured validation issues and the small predicates they rely on.
 *
 * Nothing here throws. Callers render per-field errors, so a failure has to be
 * a value they can map over, not an exception that unwinds the whole submit.
 */
export type ValidationErrorCode =
  | "required"
  | "invalid_config"
  | "invalid_value"
  | "unknown_option"
  | "unknown_grid_row"
  | "unknown_grid_column"
  | "duplicate_selection"
  | "too_short"
  | "too_long"
  | "pattern_mismatch"
  | "out_of_range"
  | "file_too_large"
  | "file_type_not_allowed";

/** An issue with no question attached yet. */
export interface AnswerIssue {
  code: ValidationErrorCode;
  message: string;
  path: (string | number)[];
}

/** An issue bound to the question it belongs to, ready to render. */
export interface ValidationError extends AnswerIssue {
  questionId: string;
}

export function issue(
  code: ValidationErrorCode,
  message: string,
  path: (string | number)[] = [],
): AnswerIssue {
  return { code, message, path };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * Whether a candidate answer counts as "not answered" for the required check.
 *
 * Absent, blank, `[]`, and `{}` are all empty, as is an object whose every
 * value is itself empty — a grid where the applicant ticked nothing still
 * arrives as `{ "row_id": [] }`. Zero is a real answer on a linear scale and is
 * never empty.
 */
export function isEmptyAnswerValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.every(isEmptyAnswerValue);
  if (isPlainObject(value)) {
    const entries = Object.values(value);
    return entries.length === 0 || entries.every(isEmptyAnswerValue);
  }
  return false;
}

/**
 * Extension to MIME mapping for upload validation.
 *
 * `answers.value` for `file_upload` is `{ path, name, size }` — the shape is
 * fixed by the schema and carries no content type — so the allowed-types check
 * resolves the type from the file name.
 */
const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  rtf: "application/rtf",
  json: "application/json",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  heic: "image/heic",
};

export function fileExtension(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

export function mimeTypeForFileName(name: string): string | null {
  const extension = fileExtension(name);
  if (extension === null) return null;
  return EXTENSION_MIME_TYPES[extension] ?? null;
}

/** Matches an exact type, a wildcard subtype such as `image` plus star, or a full wildcard. */
export function mimeTypeMatches(mimeType: string, pattern: string): boolean {
  if (pattern === "*/*" || pattern === "*") return true;
  if (pattern === mimeType) return true;
  if (pattern.endsWith("/*")) {
    return mimeType.startsWith(`${pattern.slice(0, -1)}`);
  }
  return false;
}
