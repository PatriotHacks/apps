import type { ReactElement } from "react";
import type { AnswerValueByType } from "../registry";
import type { Question, QuestionType } from "../types";

/**
 * The props every question renderer takes.
 *
 * `value` is the parsed `answers.value` for the question's type — the exact
 * shape the registry's value schema produces — or `null` when the question has
 * not been answered. Renderers are controlled: they never hold the answer,
 * they report every edit through `onChange`.
 */
export interface QuestionFieldProps<T extends QuestionType = QuestionType> {
  question: Question<T>;
  value: AnswerValueByType[T] | null;
  onChange: (value: AnswerValueByType[T] | null) => void;
  /** A message from `validateAnswer`, already narrowed to this question. */
  error?: string | null | undefined;
  disabled?: boolean | undefined;
}

export type QuestionFieldComponent<T extends QuestionType> = (
  props: QuestionFieldProps<T>,
) => ReactElement;
