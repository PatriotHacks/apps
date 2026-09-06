/**
 * Plain data models for the form engine.
 *
 * These mirror the shapes in `packages/database` but are declared independently
 * so this package stays free of any database dependency. Nothing here performs
 * I/O; every consumer hydrates these from rows it already fetched.
 */

/**
 * The 11 question types, in the same order as the `question_type` Postgres
 * enum. Order and spelling are load-bearing — they must stay in lockstep with
 * the migration that declares the enum.
 */
export const QUESTION_TYPES = [
  "short_answer",
  "paragraph",
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "linear_scale",
  "date",
  "time",
  "grid_multiple_choice",
  "grid_checkbox",
  "file_upload",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Mirrors the `branch_action` enum: continue, jump to a section, or submit. */
export const BRANCH_ACTIONS = ["next", "section", "submit"] as const;

export type BranchAction = (typeof BRANCH_ACTIONS)[number];

/** Mirrors the `option_kind` enum. One table serves choices and both grid axes. */
export const OPTION_KINDS = ["choice", "grid_row", "grid_column"] as const;

export type OptionKind = (typeof OPTION_KINDS)[number];

export function isQuestionType(value: unknown): value is QuestionType {
  return (
    typeof value === "string" &&
    (QUESTION_TYPES as readonly string[]).includes(value)
  );
}

/**
 * A row from `question_options`. `kind` decides whether it is a choice or one
 * axis of a grid. `nextAction` / `nextSectionId` are the branching fields the
 * traversal engine reads; they are carried here so this package's models are
 * already graph-complete.
 */
export interface QuestionOption {
  id: string;
  questionId: string;
  kind: OptionKind;
  label: string;
  value: string;
  position: number;
  nextAction: BranchAction;
  nextSectionId: string | null;
}

/**
 * A question plus the options that belong to it. `config` is the raw jsonb
 * blob; run it through `parseQuestionConfig` before reading it.
 */
export interface Question<T extends QuestionType = QuestionType> {
  id: string;
  sectionId: string;
  formId: string;
  type: T;
  label: string;
  helpText: string | null;
  position: number;
  required: boolean;
  editableAfterSubmit: boolean;
  config: unknown;
  options: QuestionOption[];
}

/**
 * A section plus its questions. `nextAction` / `nextSectionId` are the
 * section's own default exit, applied when no branching option overrides it.
 */
export interface FormSection {
  id: string;
  formId: string;
  title: string;
  description: string | null;
  position: number;
  nextAction: BranchAction;
  nextSectionId: string | null;
  questions: Question[];
}

/** A whole form as a directed graph of sections. */
export interface FormDefinition {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sections: FormSection[];
}

export function choiceOptions(question: Question): QuestionOption[] {
  return question.options.filter((option) => option.kind === "choice");
}

export function gridRows(question: Question): QuestionOption[] {
  return question.options.filter((option) => option.kind === "grid_row");
}

export function gridColumns(question: Question): QuestionOption[] {
  return question.options.filter((option) => option.kind === "grid_column");
}
