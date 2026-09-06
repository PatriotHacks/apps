"use client";

import { Label } from "@patriothacks/ui";
import type { ReactNode } from "react";
import type { Question } from "../types";

/**
 * The chrome every question shares: label, required marker, help text and
 * error message. The control itself is the caller's, so the ids the control
 * needs for `htmlFor`, `aria-labelledby` and `aria-describedby` are derived
 * here and exported rather than passed down.
 */

export function fieldControlId(questionId: string): string {
  return `question-${questionId}`;
}

export function fieldLabelId(questionId: string): string {
  return `question-${questionId}-label`;
}

function fieldHelpId(questionId: string): string {
  return `question-${questionId}-help`;
}

function fieldErrorId(questionId: string): string {
  return `question-${questionId}-error`;
}

/**
 * The `aria-describedby` for a question's control, so a screen reader reads
 * the help text and the error alongside the label.
 */
export function fieldDescribedBy(
  question: Question,
  error?: string | null,
  ...extraIds: (string | null)[]
): string | undefined {
  const ids: string[] = [];
  if (question.helpText) ids.push(fieldHelpId(question.id));
  if (error) ids.push(fieldErrorId(question.id));
  for (const id of extraIds) {
    if (id) ids.push(id);
  }
  return ids.length === 0 ? undefined : ids.join(" ");
}

export interface FieldShellProps {
  question: Question;
  error?: string | null | undefined;
  /**
   * Id of the single control the label points at. Omit for grouped controls —
   * radio groups, checkbox lists, grids — which carry
   * `aria-labelledby={fieldLabelId(question.id)}` instead, because a `<label>`
   * can only name one element.
   */
  labelFor?: string | undefined;
  children?: ReactNode;
}

export function FieldShell({
  question,
  error,
  labelFor,
  children,
}: FieldShellProps) {
  const labelId = fieldLabelId(question.id);
  const labelContent = (
    <>
      {question.label}
      {question.required ? <RequiredMarker /> : null}
    </>
  );

  return (
    <div className="flex flex-col gap-2" data-question-id={question.id}>
      {labelFor === undefined ? (
        <span id={labelId} className="text-sm leading-none font-medium">
          {labelContent}
        </span>
      ) : (
        <Label id={labelId} htmlFor={labelFor}>
          {labelContent}
        </Label>
      )}
      {question.helpText ? (
        <p
          id={fieldHelpId(question.id)}
          className="text-sm text-muted-foreground"
        >
          {question.helpText}
        </p>
      ) : null}
      {children}
      {error ? (
        <p
          id={fieldErrorId(question.id)}
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Visible asterisk for sighted users, spoken word for everyone else. */
function RequiredMarker() {
  return (
    <>
      <span aria-hidden="true">*</span>
      <span className="sr-only">(required)</span>
    </>
  );
}
