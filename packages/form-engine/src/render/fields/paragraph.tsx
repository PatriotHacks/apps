"use client";

import { Textarea } from "@patriothacks/ui";
import { parseQuestionConfig } from "../../parse";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
} from "../field-shell";

export function ParagraphField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"paragraph">) {
  const controlId = fieldControlId(question.id);
  const config = parseQuestionConfig("paragraph", question.config);

  return (
    <FieldShell question={question} error={error} labelFor={controlId}>
      <Textarea
        id={controlId}
        rows={4}
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
