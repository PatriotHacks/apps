import { z } from "zod";

/**
 * Zod schemas for the `answers.value` jsonb blob, one per shape.
 *
 * Several question types share a shape (every free-text and choice type stores
 * a bare string), so these are named after the shape rather than the type. The
 * registry is what binds a shape to a question type.
 */

/** `YYYY-MM-DD`. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `HH:MM` or `HH:MM:SS`, 24-hour. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** Minutes since midnight, for ordering comparisons against config bounds. */
export function timeToSeconds(value: string): number {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);
}

/** `short_answer`, `paragraph`, `multiple_choice`, `dropdown`. */
export const textValueSchema = z.string();

/** `date` — an ISO calendar date that actually exists. */
export const dateValueSchema = z
  .string()
  .refine(isCalendarDate, "Expected a calendar date formatted as YYYY-MM-DD");

/** `time` — a 24-hour wall clock time. */
export const timeValueSchema = z
  .string()
  .regex(TIME_PATTERN, "Expected a time formatted as HH:MM");

/** `linear_scale`. */
export const scaleValueSchema = z.number().int();

/** `checkboxes`. */
export const textArrayValueSchema = z.array(z.string());

/** `grid_multiple_choice` — one column id per row id. */
export const gridSingleValueSchema = z.record(z.string(), z.string());

/** `grid_checkbox` — many column ids per row id. */
export const gridMultiValueSchema = z.record(z.string(), z.array(z.string()));

/** `file_upload` — a pointer into object storage plus display metadata. */
export const fileValueSchema = z.strictObject({
  path: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
});

export type FileAnswerValue = z.infer<typeof fileValueSchema>;
