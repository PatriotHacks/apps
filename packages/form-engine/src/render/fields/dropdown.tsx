"use client";

import { choiceOptions } from "../../types";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
} from "../field-shell";

/**
 * Mirrors the `Input` primitive's styling. A native `<select>` keeps the
 * platform picker on mobile and full keyboard support for free, which matters
 * more on an application form than matching a custom listbox.
 */
const SELECT_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40";

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
      <select
        id={controlId}
        className={SELECT_CLASS}
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
      </select>
    </FieldShell>
  );
}
