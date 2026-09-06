import { z } from "zod";
import {
  QUESTION_TYPE_REGISTRY,
  type AnswerValueByType,
  type QuestionConfigByType,
  type TypedAnswer,
} from "./registry";
import { type QuestionType } from "./types";

/** A single structured problem, mirroring a Zod issue without the class. */
export interface SchemaIssue {
  code: string;
  message: string;
  path: (string | number)[];
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; issues: SchemaIssue[] };

export function toSchemaIssues(error: z.ZodError): SchemaIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.filter(
      (segment): segment is string | number => typeof segment !== "symbol",
    ),
  }));
}

/**
 * Take a question type plus an unknown blob and get back a typed value or a
 * structured error. This is the boundary every caller crosses when reading
 * `answers.value`.
 */
export function parseAnswerValue<K extends QuestionType>(
  type: K,
  value: unknown,
): ParseResult<AnswerValueByType[K]> {
  const result = QUESTION_TYPE_REGISTRY[type].valueSchema.safeParse(value);
  return result.success
    ? { success: true, data: result.data as AnswerValueByType[K] }
    : { success: false, issues: toSchemaIssues(result.error) };
}

/**
 * Parse `questions.config`. A null or absent blob is treated as an empty
 * object so type defaults apply; anything else must satisfy the type's schema
 * exactly, unknown keys included.
 */
export function parseQuestionConfig<K extends QuestionType>(
  type: K,
  config: unknown,
): ParseResult<QuestionConfigByType[K]> {
  const input = config === null || config === undefined ? {} : config;
  const result = QUESTION_TYPE_REGISTRY[type].configSchema.safeParse(input);
  return result.success
    ? { success: true, data: result.data as QuestionConfigByType[K] }
    : { success: false, issues: toSchemaIssues(result.error) };
}

/**
 * The discriminated union over `{ type, value }`, for parsing an answer
 * envelope that carries its own type — an API payload, say.
 *
 * The members are spelled out so the inferred type correlates the discriminant
 * with the value shape. The assertion below turns a missing member into a
 * compile error, so adding a question type cannot silently skip this list.
 */
export const typedAnswerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("short_answer"),
    value: QUESTION_TYPE_REGISTRY.short_answer.valueSchema,
  }),
  z.object({
    type: z.literal("paragraph"),
    value: QUESTION_TYPE_REGISTRY.paragraph.valueSchema,
  }),
  z.object({
    type: z.literal("multiple_choice"),
    value: QUESTION_TYPE_REGISTRY.multiple_choice.valueSchema,
  }),
  z.object({
    type: z.literal("checkboxes"),
    value: QUESTION_TYPE_REGISTRY.checkboxes.valueSchema,
  }),
  z.object({
    type: z.literal("dropdown"),
    value: QUESTION_TYPE_REGISTRY.dropdown.valueSchema,
  }),
  z.object({
    type: z.literal("linear_scale"),
    value: QUESTION_TYPE_REGISTRY.linear_scale.valueSchema,
  }),
  z.object({
    type: z.literal("date"),
    value: QUESTION_TYPE_REGISTRY.date.valueSchema,
  }),
  z.object({
    type: z.literal("time"),
    value: QUESTION_TYPE_REGISTRY.time.valueSchema,
  }),
  z.object({
    type: z.literal("grid_multiple_choice"),
    value: QUESTION_TYPE_REGISTRY.grid_multiple_choice.valueSchema,
  }),
  z.object({
    type: z.literal("grid_checkbox"),
    value: QUESTION_TYPE_REGISTRY.grid_checkbox.valueSchema,
  }),
  z.object({
    type: z.literal("file_upload"),
    value: QUESTION_TYPE_REGISTRY.file_upload.valueSchema,
  }),
]);

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Fails to compile if a question type is missing from the union above. */
const _answerUnionIsExhaustive: Exact<
  z.infer<typeof typedAnswerSchema>,
  TypedAnswer
> = true;

export function parseTypedAnswer(input: unknown): ParseResult<TypedAnswer> {
  const result = typedAnswerSchema.safeParse(input);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, issues: toSchemaIssues(result.error) };
}
