"use client";

import { Button, Input } from "@patriothacks/ui";
import { useState } from "react";

import {
  operatorLabel,
  operatorNeedsValue,
  operatorsFor,
  type AnswerFilter,
  type AnswerOperator,
} from "@/lib/submission-query";
import { type FilterableQuestion } from "./filterable-question";

/**
 * The per-question filter rows of the grid's GET form.
 *
 * Client-side only so the operator list can narrow when the question changes —
 * a grid answer is an object keyed by option id, so "contains" over it would
 * search ids rather than anything a reviewer typed, and offering it would lie.
 * The inputs stay native and submit with the surrounding form; nothing here
 * fetches.
 */

const BLANK: AnswerFilter = { questionId: "", operator: "contains", value: "" };

export function AnswerFilterRows({
  questions,
  initial,
}: {
  questions: FilterableQuestion[];
  initial: AnswerFilter[];
}) {
  const [rows, setRows] = useState<AnswerFilter[]>(initial.length > 0 ? initial : [BLANK]);

  const patch = (index: number, next: Partial<AnswerFilter>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...next } : row)));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const question = questions.find((q) => q.id === row.questionId);
        const operators = question ? operatorsFor(question.type) : (["contains"] as AnswerOperator[]);
        const operator = operators.includes(row.operator) ? row.operator : (operators[0] as AnswerOperator);
        const needsValue = operatorNeedsValue(operator);

        return (
          // Rows are positional: the three params are index-aligned on the
          // server, so a stable key by index is exactly right here.
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              name="fq"
              aria-label="Question to filter on"
              className="h-9 min-w-48 rounded-md border bg-background px-2 text-sm"
              value={row.questionId}
              onChange={(event) => patch(index, { questionId: event.target.value })}
            >
              <option value="">No question filter</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>

            <select
              name="fop"
              aria-label="Filter operator"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={operator}
              onChange={(event) => {
                const next = event.target.value as AnswerOperator;
                patch(index, {
                  operator: next,
                  value: operatorNeedsValue(next) ? row.value : "",
                });
              }}
            >
              {operators.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {operatorLabel(question?.type ?? "short_answer", candidate)}
                </option>
              ))}
            </select>

            <Input
              name="fv"
              aria-label="Filter value"
              className="h-9 w-48"
              placeholder={needsValue ? "Value" : "Not needed"}
              readOnly={!needsValue}
              value={row.value}
              onChange={(event) => patch(index, { value: event.target.value })}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        );
      })}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((current) => [...current, BLANK])}
        >
          Add answer filter
        </Button>
      </div>
    </div>
  );
}
