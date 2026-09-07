"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDelete } from "./[id]/edit/controls";
import { deleteForm } from "./actions";

/**
 * Deleting a whole form, offered wherever a form is: the list and the builder.
 *
 * The confirmation names the submission count because that is the number that
 * decides whether this is housekeeping or a mistake — an untouched draft and a
 * form 400 people have applied through are otherwise the same click. The count
 * is sent with the request and re-checked server-side, so one that changed while
 * the panel sat open refuses rather than proceeds.
 */
export function DeleteForm({
  formId,
  title,
  submissionCount,
  redirectTo,
  trigger = "Delete",
}: {
  formId: string;
  title: string;
  submissionCount: number;
  redirectTo?: string;
  trigger?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <ConfirmDelete
        trigger={trigger}
        heading={`Delete ${title}?`}
        confirmLabel="Delete this form"
        disabled={pending}
        body={
          <>
            <p>
              {submissionCount === 0
                ? "No one has submitted this form."
                : `${submissionCount} ${submissionCount === 1 ? "person has" : "people have"} submitted this form.`}{" "}
              It disappears from the console and from every applicant immediately.
            </p>
            <p className="mt-1">
              {submissionCount === 0
                ? "Nothing is destroyed — the form is hidden rather than removed, and its URL stays reserved."
                : "Their submissions and answers are kept, but nothing in the console will reach them once the form is gone."}
            </p>
          </>
        }
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteForm(formId, submissionCount);
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            setMessage(null);
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          })
        }
      />

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
