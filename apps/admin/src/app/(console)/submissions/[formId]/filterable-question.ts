import { type Question, type QuestionType } from "@patriothacks/form-engine";

/**
 * The slice of a question the filter rows need. A `Question` carries its
 * options and raw config, none of which has to cross the server/client
 * boundary just to render a `<select>`.
 */
export interface FilterableQuestion {
  id: string;
  label: string;
  type: QuestionType;
}

export const filterableQuestion = (question: Question): FilterableQuestion => ({
  id: question.id,
  label: question.label,
  type: question.type,
});
