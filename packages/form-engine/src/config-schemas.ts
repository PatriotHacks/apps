import { z } from "zod";
import { isCalendarDate, timeToSeconds } from "./value-schemas";

/**
 * Zod schemas for the `questions.config` jsonb blob, one per shape.
 *
 * Every schema is strict: an unrecognized key is a builder bug and must fail at
 * parse time rather than silently producing a form with a rule that never runs.
 */

export const DEFAULT_ALLOWED_MIME_TYPES = ["application/pdf"] as const;
export const DEFAULT_MAX_UPLOAD_BYTES = 10_485_760;

export const DEFAULT_SCALE_MIN = 1;
export const DEFAULT_SCALE_MAX = 5;

function isCompilableRegExp(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/** Types that carry no type-specific settings: choice types and grid types. */
export const emptyConfigSchema = z.strictObject({});

/** `short_answer` and `paragraph`. */
export const textConfigSchema = z
  .strictObject({
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    pattern: z.string().min(1).optional(),
  })
  .refine(
    (config) =>
      config.minLength === undefined ||
      config.maxLength === undefined ||
      config.minLength <= config.maxLength,
    { message: "minLength must not exceed maxLength", path: ["minLength"] },
  )
  .refine(
    (config) =>
      config.pattern === undefined || isCompilableRegExp(config.pattern),
    { message: "pattern must be a valid regular expression", path: ["pattern"] },
  );

/** `linear_scale`. */
export const linearScaleConfigSchema = z
  .strictObject({
    min: z.number().int().default(DEFAULT_SCALE_MIN),
    max: z.number().int().default(DEFAULT_SCALE_MAX),
    minLabel: z.string().optional(),
    maxLabel: z.string().optional(),
  })
  .refine((config) => config.min < config.max, {
    message: "min must be less than max",
    path: ["min"],
  });

/** `file_upload`. */
export const fileUploadConfigSchema = z.strictObject({
  allowedMimeTypes: z
    .array(z.string().min(1))
    .min(1, "At least one MIME type must be allowed")
    .default([...DEFAULT_ALLOWED_MIME_TYPES]),
  maxBytes: z.number().int().positive().default(DEFAULT_MAX_UPLOAD_BYTES),
});

/** `date`. */
export const dateConfigSchema = z
  .strictObject({
    min: z
      .string()
      .refine(isCalendarDate, "Expected a date formatted as YYYY-MM-DD")
      .optional(),
    max: z
      .string()
      .refine(isCalendarDate, "Expected a date formatted as YYYY-MM-DD")
      .optional(),
  })
  .refine(
    (config) =>
      config.min === undefined ||
      config.max === undefined ||
      config.min <= config.max,
    { message: "min must not be later than max", path: ["min"] },
  );

const timeBoundSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    "Expected a time formatted as HH:MM",
  );

/** `time`. */
export const timeConfigSchema = z
  .strictObject({
    min: timeBoundSchema.optional(),
    max: timeBoundSchema.optional(),
  })
  .refine(
    (config) =>
      config.min === undefined ||
      config.max === undefined ||
      timeToSeconds(config.min) <= timeToSeconds(config.max),
    { message: "min must not be later than max", path: ["min"] },
  );

export type TextConfig = z.infer<typeof textConfigSchema>;
export type LinearScaleConfig = z.infer<typeof linearScaleConfigSchema>;
export type FileUploadConfig = z.infer<typeof fileUploadConfigSchema>;
export type DateConfig = z.infer<typeof dateConfigSchema>;
export type TimeConfig = z.infer<typeof timeConfigSchema>;
export type EmptyConfig = z.infer<typeof emptyConfigSchema>;
