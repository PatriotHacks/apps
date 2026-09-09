"use client";

import { Select } from "@patriothacks/ui";
import { choiceOptions } from "../../types";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
} from "../field-shell";

/**
 * `Select` is a styled native `<select>`, which keeps the platform picker on
 * mobile and full keyboard support for free — worth more on an application
 * form than matching a custom listbox.
 */
export function DropdownField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"dropdown">) {
  const controlId = fieldControlId(question.id);

  return (
    <FieldShell question={question} error={error} labelFor={controlId}>
      <Select
        id={controlId}
        value={value ?? ""}
        disabled={disabled}
        aria-required={question.required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(question, error)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select an option</option>
        {choiceOptions(question).map((option) => (
          <option key={option.id} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}
