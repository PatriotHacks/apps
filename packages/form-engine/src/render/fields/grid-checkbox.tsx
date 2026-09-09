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
 * The multi-select grid. Same table semantics as the single-select grid, and
 * the same native inputs for the same reason: nothing may sit between a `<tr>`
 * and its `<td>`s.
 */
export function GridCheckboxField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"grid_checkbox">) {
  const controlId = fieldControlId(question.id);
  const rows = gridRows(question);
  const columns = gridColumns(question);
  const selection = value ?? {};

  // Rebuilt from the column list so a row stays in column order and cannot
  // hold the same column twice.
  function toggle(rowId: string, columnId: string, checked: boolean): void {
    const current = selection[rowId] ?? [];
    const next = checked
      ? columns
          .filter(
            (column) => column.id === columnId || current.includes(column.id),
          )
          .map((column) => column.id)
      : current.filter((entry) => entry !== columnId);
    onChange({ ...selection, [rowId]: next });
  }

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
                      type="checkbox"
                      className="size-5 accent-primary sm:size-4"
                      value={column.id}
                      checked={(selection[row.id] ?? []).includes(column.id)}
                      disabled={disabled}
                      aria-labelledby={`${gridRowHeaderId(controlId, row.id)} ${gridColumnHeaderId(controlId, column.id)}`}
                      onChange={(event) =>
                        toggle(row.id, column.id, event.target.checked)
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
