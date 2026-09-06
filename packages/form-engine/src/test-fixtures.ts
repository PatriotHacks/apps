import type {
  FormDefinition,
  FormSection,
  Question,
  QuestionOption,
  QuestionType,
} from "./types";

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

/** Marks an option that ends the form, as opposed to one naming a section. */
export const SUBMIT = { submit: true } as const;

/**
 * A single-select question whose options carry the outcomes given: a section id
 * to jump to, `SUBMIT` to end the form, or null for a plain non-branching
 * option.
 */
export function makeBranchQuestion<T extends "multiple_choice" | "dropdown">(
  type: T,
  targets: Record<string, string | typeof SUBMIT | null>,
  overrides: Partial<Omit<Question<T>, "type" | "options">> = {},
): Question<T> {
  return makeQuestion(type, {
    ...overrides,
    options: Object.entries(targets).map(([value, target], index) =>
      makeOption({
        kind: "choice",
        value,
        label: value,
        position: index,
        nextAction:
          target === null ? "next" : target === SUBMIT ? "submit" : "section",
        nextSectionId: typeof target === "string" ? target : null,
      }),
    ),
  });
}

export function makeSection(overrides: Partial<FormSection> = {}): FormSection {
  counter += 1;
  const id = overrides.id ?? `section-${counter}`;
  return {
    formId: "form-1",
    title: `Section ${id}`,
    description: null,
    position: counter,
    nextAction: "next",
    nextSectionId: null,
    ...overrides,
    id,
    questions: (overrides.questions ?? []).map((question) => ({
      ...question,
      sectionId: id,
    })),
  };
}

export function makeForm(
  sections: FormSection[],
  overrides: Partial<Omit<FormDefinition, "sections">> = {},
): FormDefinition {
  return {
    id: "form-1",
    slug: "form",
    title: "Form",
    description: null,
    ...overrides,
    sections,
  };
}
