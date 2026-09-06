import type { Question, QuestionOption, QuestionType } from "./types";

let counter = 0;

export function makeOption(
  overrides: Partial<QuestionOption> = {},
): QuestionOption {
  counter += 1;
  const value = overrides.value ?? `opt-${counter}`;
  return {
    id: `option-${counter}`,
    questionId: "question-1",
    kind: "choice",
    label: value,
    value,
    position: counter,
    nextAction: "next",
    nextSectionId: null,
    ...overrides,
  };
}

export function makeQuestion<T extends QuestionType>(
  type: T,
  overrides: Partial<Omit<Question<T>, "type">> = {},
): Question<T> {
  counter += 1;
  return {
    id: `question-${counter}`,
    sectionId: "section-1",
    formId: "form-1",
    type,
    label: `Question ${counter}`,
    helpText: null,
    position: counter,
    required: false,
    editableAfterSubmit: false,
    config: {},
    options: [],
    ...overrides,
  };
}

/** A choice question whose option values are exactly `values`. */
export function makeChoiceQuestion<
  T extends "multiple_choice" | "checkboxes" | "dropdown",
>(
  type: T,
  values: string[],
  overrides: Partial<Omit<Question<T>, "type" | "options">> = {},
): Question<T> {
  return makeQuestion(type, {
    ...overrides,
    options: values.map((value, index) =>
      makeOption({ kind: "choice", value, label: value, position: index }),
    ),
  });
}

/** A grid question whose row and column ids are exactly the ids given. */
export function makeGridQuestion<
  T extends "grid_multiple_choice" | "grid_checkbox",
>(
  type: T,
  rowIds: string[],
  columnIds: string[],
  overrides: Partial<Omit<Question<T>, "type" | "options">> = {},
): Question<T> {
  return makeQuestion(type, {
    ...overrides,
    options: [
      ...rowIds.map((id, index) =>
        makeOption({ id, kind: "grid_row", value: id, position: index }),
      ),
      ...columnIds.map((id, index) =>
        makeOption({ id, kind: "grid_column", value: id, position: index }),
      ),
    ],
  });
}
