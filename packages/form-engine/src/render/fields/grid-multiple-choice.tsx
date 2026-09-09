"use client";

import { gridColumns, gridRows } from "../../types";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
  fieldLabelId,
} from "../field-shell";
import { gridColumnHeaderId, gridRowHeaderId } from "./grid-ids";

/**
 * One radio per cell, grouped per row by the shared `name`.
 *
 * These are native inputs rather than the `RadioGroup` primitive because a
 * radio group needs a wrapping element and nothing may sit between a `<tr>`
 * and its `<td>`s. Each cell takes its accessible name from the row and column
 * headers, which is what a screen reader needs to place it in the grid.
 */
export function GridMultipleChoiceField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"grid_multiple_choice">) {
  const controlId = fieldControlId(question.id);
  const rows = gridRows(question);
  const columns = gridColumns(question);
  const selection = value ?? {};

  return (
    <FieldShell question={question} error={error}>
      <div
        role="group"
        className="overflow-x-auto"
        aria-labelledby={fieldLabelId(question.id)}
        aria-describedby={fieldDescribedBy(question, error)}
      >
        <table className="w-auto min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <td />
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  id={gridColumnHeaderId(controlId, column.id)}
                  className="px-2 pb-2 text-center font-medium"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <th
                  scope="row"
                  id={gridRowHeaderId(controlId, row.id)}
                  className="min-w-[9rem] py-2 pr-4 text-left font-normal"
                >
                  {row.label}
                </th>
                {columns.map((column) => (
                  <td key={column.id} className="px-2 py-2 text-center">
                    <input
                      type="radio"
                      className="size-5 accent-primary sm:size-4"
                      name={`${controlId}-${row.id}`}
                      value={column.id}
                      checked={selection[row.id] === column.id}
                      disabled={disabled}
                      aria-labelledby={`${gridRowHeaderId(controlId, row.id)} ${gridColumnHeaderId(controlId, column.id)}`}
                      onChange={() =>
                        onChange({ ...selection, [row.id]: column.id })
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FieldShell>
  );
}
