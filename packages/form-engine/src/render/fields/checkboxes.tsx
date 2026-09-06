"use client";

import { Checkbox, Label } from "@patriothacks/ui";
import { choiceOptions } from "../../types";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
  fieldLabelId,
} from "../field-shell";

export function CheckboxesField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"checkboxes">) {
  const controlId = fieldControlId(question.id);
  const options = choiceOptions(question);
  const selected = value ?? [];

  // Rebuilding from the option list rather than appending keeps the answer in
  // option order and makes a duplicate selection unrepresentable.
  function toggle(optionValue: string, checked: boolean): void {
    const next = checked
      ? options
          .filter(
            (option) =>
              option.value === optionValue || selected.includes(option.value),
          )
          .map((option) => option.value)
      : selected.filter((entry) => entry !== optionValue);
    onChange(next);
  }

  return (
    <FieldShell question={question} error={error}>
      <div
        role="group"
        className="flex flex-col gap-3"
        aria-labelledby={fieldLabelId(question.id)}
        aria-describedby={fieldDescribedBy(question, error)}
      >
        {options.map((option) => {
          const optionId = `${controlId}-${option.id}`;
          return (
            <div key={option.id} className="flex items-center gap-2">
              <Checkbox
                id={optionId}
                checked={selected.includes(option.value)}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                onCheckedChange={(checked) =>
                  toggle(option.value, checked === true)
                }
              />
              <Label htmlFor={optionId} className="font-normal">
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>
    </FieldShell>
  );
}
