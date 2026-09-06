"use client";

import type { QuestionType } from "../types";
import type {
  QuestionFieldComponent,
  QuestionFieldProps,
} from "./field-props";
import { CheckboxesField } from "./fields/checkboxes";
import { DateField } from "./fields/date";
import { DropdownField } from "./fields/dropdown";
import { FileUploadField } from "./fields/file-upload";
import { GridCheckboxField } from "./fields/grid-checkbox";
import { GridMultipleChoiceField } from "./fields/grid-multiple-choice";
import { LinearScaleField } from "./fields/linear-scale";
import { MultipleChoiceField } from "./fields/multiple-choice";
import { ParagraphField } from "./fields/paragraph";
import { ShortAnswerField } from "./fields/short-answer";
import { TimeField } from "./fields/time";

/**
 * One renderer per question type, keyed the same way as
 * `QUESTION_TYPE_REGISTRY`. The `satisfies` turns a missing entry into a
 * compile error, so a 12th type is one registry entry plus one component and
 * nothing else changes.
 */
export const QUESTION_FIELD_COMPONENTS = {
  short_answer: ShortAnswerField,
  paragraph: ParagraphField,
  multiple_choice: MultipleChoiceField,
  checkboxes: CheckboxesField,
  dropdown: DropdownField,
  linear_scale: LinearScaleField,
  date: DateField,
  time: TimeField,
  grid_multiple_choice: GridMultipleChoiceField,
  grid_checkbox: GridCheckboxField,
  file_upload: FileUploadField,
} as const satisfies { [K in QuestionType]: QuestionFieldComponent<K> };

/** Renders whichever component the question's type maps to. */
export function QuestionField(props: QuestionFieldProps) {
  // The map correlates each entry's question type with its value shape, but
  // that correlation is not resolvable through a union-typed `question.type`.
  const Field = QUESTION_FIELD_COMPONENTS[
    props.question.type
  ] as QuestionFieldComponent<QuestionType>;
  return <Field {...props} />;
}
