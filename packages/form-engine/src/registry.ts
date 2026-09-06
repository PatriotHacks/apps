import type { z } from "zod";
import {
  dateConfigSchema,
  emptyConfigSchema,
  fileUploadConfigSchema,
  linearScaleConfigSchema,
  textConfigSchema,
  timeConfigSchema,
} from "./config-schemas";
import { QUESTION_TYPES, type QuestionType } from "./types";
import {
  dateValueSchema,
  fileValueSchema,
  gridMultiValueSchema,
  gridSingleValueSchema,
  scaleValueSchema,
  textArrayValueSchema,
  textValueSchema,
  timeValueSchema,
} from "./value-schemas";

/**
 * The registry is the extension point. Adding a 12th question type means
 * appending it to `QUESTION_TYPES` (to stay aligned with the Postgres enum) and
 * adding one entry below. Every other module reads capabilities off the
 * registry rather than switching on the type, so nothing else has to change.
 */
export interface QuestionTypeDefinition<
  TValue extends z.ZodType = z.ZodType,
  TConfig extends z.ZodType = z.ZodType,
> {
  /** Human-readable name for builder menus and export headers. */
  readonly label: string;
  /** Takes `question_options` rows with `kind = 'choice'`. */
  readonly hasOptions: boolean;
  /** Takes `question_options` rows with `kind = 'grid_row' | 'grid_column'`. */
  readonly hasGrid: boolean;
  /**
   * May carry per-option branching. Only single-select choice types qualify:
   * a multi-select answer has no single next section to resolve to.
   */
  readonly canBranch: boolean;
  /** Validates the `answers.value` jsonb blob. */
  readonly valueSchema: TValue;
  /** Validates the `questions.config` jsonb blob. */
  readonly configSchema: TConfig;
}

function define<TValue extends z.ZodType, TConfig extends z.ZodType>(
  definition: QuestionTypeDefinition<TValue, TConfig>,
): QuestionTypeDefinition<TValue, TConfig> {
  return definition;
}

export const QUESTION_TYPE_REGISTRY = {
  short_answer: define({
    label: "Short answer",
    hasOptions: false,
    hasGrid: false,
    canBranch: false,
    valueSchema: textValueSchema,
    configSchema: textConfigSchema,
  }),
  paragraph: define({
    label: "Paragraph",
    hasOptions: false,
    hasGrid: false,
    canBranch: false,
    valueSchema: textValueSchema,
    configSchema: textConfigSchema,
  }),
  multiple_choice: define({
    label: "Multiple choice",
    hasOptions: true,
    hasGrid: false,
    canBranch: true,
    valueSchema: textValueSchema,
    configSchema: emptyConfigSchema,
  }),
  checkboxes: define({
    label: "Checkboxes",
    hasOptions: true,
    hasGrid: false,
    canBranch: false,
    valueSchema: textArrayValueSchema,
    configSchema: emptyConfigSchema,
  }),
  dropdown: define({
    label: "Dropdown",
    hasOptions: true,
    hasGrid: false,
    canBranch: true,
    valueSchema: textValueSchema,
    configSchema: emptyConfigSchema,
  }),
  linear_scale: define({
    label: "Linear scale",
    hasOptions: false,
    hasGrid: false,
    canBranch: false,
    valueSchema: scaleValueSchema,
    configSchema: linearScaleConfigSchema,
  }),
  date: define({
    label: "Date",
    hasOptions: false,
    hasGrid: false,
    canBranch: false,
    valueSchema: dateValueSchema,
    configSchema: dateConfigSchema,
  }),
  time: define({
    label: "Time",
    hasOptions: false,
    hasGrid: false,
    canBranch: false,
    valueSchema: timeValueSchema,
    configSchema: timeConfigSchema,
  }),
  grid_multiple_choice: define({
    label: "Multiple choice grid",
    hasOptions: false,
    hasGrid: true,
    canBranch: false,
    valueSchema: gridSingleValueSchema,
    configSchema: emptyConfigSchema,
  }),
  grid_checkbox: define({
    label: "Checkbox grid",
    hasOptions: false,
    hasGrid: true,
    canBranch: false,
    valueSchema: gridMultiValueSchema,
    configSchema: emptyConfigSchema,
  }),
  file_upload: define({
    label: "File upload",
    hasOptions: false,
    hasGrid: false,
    canBranch: false,
    valueSchema: fileValueSchema,
    configSchema: fileUploadConfigSchema,
  }),
} as const satisfies Record<QuestionType, QuestionTypeDefinition>;

export type QuestionTypeRegistry = typeof QUESTION_TYPE_REGISTRY;

export function getQuestionTypeDefinition<T extends QuestionType>(
  type: T,
): QuestionTypeRegistry[T] {
  return QUESTION_TYPE_REGISTRY[type];
}

/** Types whose options may carry `next_action = 'section'`. */
export const BRANCHABLE_QUESTION_TYPES = QUESTION_TYPES.filter(
  (type) => QUESTION_TYPE_REGISTRY[type].canBranch,
);

export function canBranch(type: QuestionType): boolean {
  return QUESTION_TYPE_REGISTRY[type].canBranch;
}

export function hasOptions(type: QuestionType): boolean {
  return QUESTION_TYPE_REGISTRY[type].hasOptions;
}

export function hasGrid(type: QuestionType): boolean {
  return QUESTION_TYPE_REGISTRY[type].hasGrid;
}

/** The parsed `answers.value` shape for each question type. */
export type AnswerValueByType = {
  [K in QuestionType]: z.infer<QuestionTypeRegistry[K]["valueSchema"]>;
};

/** The parsed `questions.config` shape for each question type. */
export type QuestionConfigByType = {
  [K in QuestionType]: z.infer<QuestionTypeRegistry[K]["configSchema"]>;
};

/**
 * A question type paired with its value — the discriminated union callers
 * carry once an answer has been parsed.
 */
export type TypedAnswer = {
  [K in QuestionType]: { type: K; value: AnswerValueByType[K] };
}[QuestionType];

export type TypedQuestionConfig = {
  [K in QuestionType]: { type: K; config: QuestionConfigByType[K] };
}[QuestionType];
