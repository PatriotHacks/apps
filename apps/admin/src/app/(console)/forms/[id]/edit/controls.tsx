"use client";

import { Button, Label } from "@patriothacks/ui";
import type { BranchAction } from "@patriothacks/form-engine";
import { useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "./actions";

/** Matches the `Input` primitive so a native select sits level with the rest. */
export const SELECT_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30";

/**
 * Structure lives in the database, not in React state, so every edit is a
 * server action and the page re-renders from the row it just wrote. This is the
 * pending flag and the one error message that go with that.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(work: () => Promise<ActionResult | void>): void {
    startTransition(async () => {
      const result = await work();
      setMessage(result && !result.ok ? result.message : null);
    });
  }

  return { pending, message, run };
}

/**
 * Local state for a text field that must still follow the server once an action
 * has revalidated the page. Adjusting state during render is cheaper than an
 * effect: React re-runs this component immediately and never commits the stale
 * value.
 */
export function useSynced<T>(incoming: T): [T, (next: T) => void] {
  const [value, setValue] = useState(incoming);
  const [seen, setSeen] = useState(incoming);
  if (incoming !== seen) {
    setSeen(incoming);
    setValue(incoming);
  }
  return [value, setValue];
}

export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function OrderControls({
  name,
  canMoveUp,
  canMoveDown,
  disabled,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`Move ${name} up`}
        disabled={disabled || !canMoveUp}
        onClick={onMoveUp}
      >
        ↑
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`Move ${name} down`}
        disabled={disabled || !canMoveDown}
        onClick={onMoveDown}
      >
        ↓
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`Delete ${name}`}
        disabled={disabled}
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
}

export interface BranchTarget {
  id: string;
  label: string;
}

const NEXT = "next";
const SUBMIT = "submit";
const SECTION_PREFIX = "section:";

/**
 * Continue, jump, or submit. Only sections further down the form are offered:
 * forward-only jumps are what make a cycle structurally impossible, so the
 * control never lets one be expressed in the first place.
 */
export function BranchSelect({
  id,
  label,
  action,
  targetId,
  targets,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  action: BranchAction;
  targetId: string | null;
  targets: BranchTarget[];
  disabled: boolean;
  onChange: (action: BranchAction, targetId: string | null) => void;
}) {
  const value = action === "section" && targetId ? `${SECTION_PREFIX}${targetId}` : action;

  return (
    <Field id={id} label={label}>
      <select
        id={id}
        className={SELECT_CLASS}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (next.startsWith(SECTION_PREFIX)) {
            onChange("section", next.slice(SECTION_PREFIX.length));
            return;
          }
          onChange(next as BranchAction, null);
        }}
      >
        <option value={NEXT}>Continue to the next section</option>
        <option value={SUBMIT}>Submit the form</option>
        {targets.map((target) => (
          <option key={target.id} value={`${SECTION_PREFIX}${target.id}`}>
            Jump to {target.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
