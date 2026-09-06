"use client";

import { Button, Input, Label } from "@patriothacks/ui";
import { useActionState, useState } from "react";

import { SLUG_PATTERN, toOptionValue } from "@/lib/slug";

import { createForm, type CreateFormState } from "./actions";

const INITIAL: CreateFormState = { message: null };

/** "Hacker Application 2026" reads as `hacker-application-2026`. */
const suggestSlug = (title: string) => toOptionValue(title).replaceAll("_", "-");

export function NewForm() {
  const [state, action, pending] = useActionState(createForm, INITIAL);
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          onChange={(event) => {
            if (!touched) setSlug(suggestSlug(event.target.value));
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          pattern={SLUG_PATTERN}
          value={slug}
          onChange={(event) => {
            setTouched(true);
            setSlug(event.target.value);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Applicants will open this form at /{slug || "your-slug"}.
        </p>
      </div>

      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
