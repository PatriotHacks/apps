"use client";

import { Input } from "@patriothacks/ui";
import { parseQuestionConfig } from "../../parse";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
} from "../field-shell";

export function ShortAnswerField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"short_answer">) {
  const controlId = fieldControlId(question.id);
  const config = parseQuestionConfig("short_answer", question.config);

  return (
    <FieldShell question={question} error={error} labelFor={controlId}>
      <Input
        id={controlId}
        type="text"
        value={value ?? ""}
        maxLength={config.success ? config.data.maxLength : undefined}
        disabled={disabled}
        aria-required={question.required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(question, error)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}
