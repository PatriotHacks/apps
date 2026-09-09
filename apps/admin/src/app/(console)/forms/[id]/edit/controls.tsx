"use client";

import { Button, Label, Select, cn } from "@patriothacks/ui";
import type { BranchAction } from "@patriothacks/form-engine";
import { useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "./actions";

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

  // An option's branch sits on the option's own row, where a second visible
  // label would only repeat what the row already says.
  const select = (
      <Select
        id={id}
        aria-label={label.length > 0 ? undefined : "Where this leads"}
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
      </Select>
  );

  if (label.length === 0) return select;
  return (
    <Field id={id} label={label}>
      {select}
    </Field>
  );
}

/**
 * A text field that reads as text until you edit it. The border only appears on
 * hover and focus, so a card at rest looks like the form it describes rather
 * than a rack of inputs — which is the whole point of editing in place.
 */
export function InlineInput({
  value,
  placeholder,
  disabled,
  className,
  ariaLabel,
  onChange,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
  onChange: (next: string) => void;
  onCommit: () => void;
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.currentTarget.blur();
      }}
      className={cn(
        "w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 outline-none",
        "hover:border-input focus:border-ring focus:ring-[3px] focus:ring-ring/50",
        "placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    />
  );
}

/**
 * Destructive actions do not fire on the first click. The button opens into a
 * panel that spells out what is about to be lost — the caller passes the count,
 * because "3 answers" is a fact an admin can weigh and "this cannot be undone"
 * is not — and only the second, differently-labelled button commits.
 *
 * Deliberately inline rather than a modal: the thing being deleted stays on
 * screen beside the warning about deleting it.
 */
export function ConfirmDelete({
  trigger,
  heading,
  body,
  confirmLabel,
  disabled,
  onConfirm,
}: {
  trigger: string;
  heading: string;
  body: ReactNode;
  confirmLabel: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-2 rounded-md border-2 border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm font-semibold text-destructive">{heading}</p>
      <div className="text-sm text-destructive/90">{body}</div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={disabled}
          onClick={() => {
            setOpen(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => setOpen(false)}
        >
          Keep it
        </Button>
      </div>
    </div>
  );
}

/** The count as a phrase, so call sites are not each rebuilding the plural. */
export function answerPhrase(count: number): string {
  return `${count} ${count === 1 ? "answer" : "answers"}`;
}
