import {
  makeChoiceQuestion,
  makeGridQuestion,
  makeQuestion,
} from "../test-fixtures";
import type { Question, QuestionType } from "../types";

/**
 * One question per type, all sharing a label, option values and grid axes so a
 * renderer suite can loop over `QUESTION_TYPES` and assert the same things.
 */

export const QUESTION_LABEL = "Availability";

export const CHOICE_VALUES = ["alpha", "beta"];

export const GRID_ROW_IDS = ["row-hardware", "row-design"];

export const GRID_COLUMN_IDS = ["column-yes", "column-no"];

type QuestionOverrides = Partial<Omit<Question, "type" | "options">>;

export function questionOfType(
  type: QuestionType,
  overrides: QuestionOverrides = {},
): Question {
  const shared = { label: QUESTION_LABEL, ...overrides };

  if (type === "multiple_choice" || type === "checkboxes" || type === "dropdown") {
    return makeChoiceQuestion(type, CHOICE_VALUES, shared);
  }
  if (type === "grid_multiple_choice" || type === "grid_checkbox") {
    return makeGridQuestion(type, GRID_ROW_IDS, GRID_COLUMN_IDS, shared);
  }
  return makeQuestion(type, shared);
}
