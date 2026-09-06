"use client";

import { Input } from "@patriothacks/ui";
import { parseQuestionConfig } from "../../parse";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
} from "../field-shell";

export function TimeField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"time">) {
  const controlId = fieldControlId(question.id);
  const config = parseQuestionConfig("time", question.config);

  return (
    <FieldShell question={question} error={error} labelFor={controlId}>
      <Input
        id={controlId}
        type="time"
        value={value ?? ""}
        min={config.success ? config.data.min : undefined}
        max={config.success ? config.data.max : undefined}
        disabled={disabled}
        aria-required={question.required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(question, error)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}
