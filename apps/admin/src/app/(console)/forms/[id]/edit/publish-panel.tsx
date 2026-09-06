"use client";

import type { GraphError } from "@patriothacks/form-engine";
import { Button, Input, Label } from "@patriothacks/ui";
import { useState, useTransition } from "react";

import { publishForm, type PublishFailure } from "./actions";

function ErrorList({ errors }: { errors: GraphError[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-destructive">
      {errors.map((error) => (
        <li key={`${error.code}-${error.sectionId}-${error.optionId}-${error.message}`}>
          {error.message}
        </li>
      ))}
    </ul>
  );
}

export function PublishPanel({
  formId,
  slug,
  errors,
}: {
  formId: string;
  slug: string;
  errors: GraphError[];
}) {
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState("");
  const [failure, setFailure] = useState<PublishFailure | null>(null);

  const shown = failure?.errors.length ? failure.errors : errors;

  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4">
      <h2 className="text-sm font-semibold text-destructive">Publish is permanent</h2>
      <p className="text-sm text-destructive/90">
        Publishing freezes this form for good. Sections, questions, options and branch targets can
        never be changed, reordered or deleted afterwards — not by an admin, not by support.
        Applicants answer against this exact shape, so a form published with broken branching can
        never be repaired. To ask something different you have to create a new form.
      </p>

      {shown.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-destructive">
            {shown.length} {shown.length === 1 ? "problem" : "problems"} in the branching:
          </p>
          <ErrorList errors={shown} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">The section graph validates.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="publish-confirmation" className="text-xs text-muted-foreground">
          Type {slug} to confirm
        </Label>
        <Input
          id="publish-confirmation"
          value={confirmation}
          placeholder={slug}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>

      {failure?.message ? (
        <p className="text-sm font-medium text-destructive">{failure.message}</p>
      ) : null}

      <div>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending || confirmation !== slug}
          onClick={() =>
            startTransition(async () => {
              setFailure(await publishForm(formId, confirmation));
            })
          }
        >
          {pending ? "Publishing…" : "Publish permanently"}
        </Button>
      </div>
    </section>
  );
}
