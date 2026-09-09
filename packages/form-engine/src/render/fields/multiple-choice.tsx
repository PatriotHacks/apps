"use client";

import { Label, RadioGroup, RadioGroupItem } from "@patriothacks/ui";
import { choiceOptions } from "../../types";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
  fieldLabelId,
} from "../field-shell";

export function MultipleChoiceField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"multiple_choice">) {
  const controlId = fieldControlId(question.id);

  return (
    <FieldShell question={question} error={error}>
      <RadioGroup
        value={value ?? ""}
        disabled={disabled}
        aria-labelledby={fieldLabelId(question.id)}
        aria-describedby={fieldDescribedBy(question, error)}
        aria-required={question.required}
        aria-invalid={error ? true : undefined}
        onValueChange={onChange}
      >
        {choiceOptions(question).map((option) => {
          const optionId = `${controlId}-${option.id}`;
          return (
            <div key={option.id} className="flex items-start gap-3">
              <RadioGroupItem id={optionId} value={option.value} />
              <Label htmlFor={optionId} className="font-normal">
                {option.label}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </FieldShell>
  );
}
