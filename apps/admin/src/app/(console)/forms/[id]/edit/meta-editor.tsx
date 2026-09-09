"use client";

import type { Form } from "@patriothacks/database";
import { Button, Input, Select, Textarea } from "@patriothacks/ui";
import { useState } from "react";

import { SLUG_PATTERN } from "@/lib/slug";

import { updateMeta } from "./actions";
import { Field, useAction } from "./controls";

const EDIT_POLICIES: { value: Form["editPolicy"]; label: string }[] = [
  { value: "locked", label: "Locked once submitted" },
  { value: "per_question", label: "Only questions marked editable" },
  { value: "full", label: "Fully editable after submit" },
];

/**
 * `datetime-local` carries no zone and the console reads and writes Eastern, so
 * the input has to be handed Eastern wall-clock rather than the instant's UTC
 * face. `h23` rather than `hour12: false`, which can render midnight as "24".
 */
const INPUT_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function toInputValue(value: Date | null): string {
  if (!value) return "";
  const part = Object.fromEntries(
    INPUT_TIME.formatToParts(value).map(({ type, value: text }) => [type, text]),
  );
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
}

export function MetaEditor({ form }: { form: Form }) {
  const { pending, message, run } = useAction();
  const [draft, setDraft] = useState({
    title: form.title,
    slug: form.slug,
    description: form.description ?? "",
    editPolicy: form.editPolicy as string,
    opensAt: toInputValue(form.opensAt),
    closesAt: toInputValue(form.closesAt),
  });

  const set = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-t-4 border-t-primary bg-card p-4">
      <h2 className="text-sm font-semibold">Form details</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="meta-title" label="Title">
          <Input
            id="meta-title"
            value={draft.title}
            onChange={(event) => set({ title: event.target.value })}
          />
        </Field>

        <Field id="meta-slug" label="Slug">
          <Input
            id="meta-slug"
            value={draft.slug}
            pattern={SLUG_PATTERN}
            onChange={(event) => set({ slug: event.target.value })}
          />
        </Field>
      </div>

      <Field id="meta-description" label="Description">
        <Textarea
          id="meta-description"
          rows={2}
          value={draft.description}
          onChange={(event) => set({ description: event.target.value })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="meta-edit-policy" label="Edit policy">
          <Select
            id="meta-edit-policy"
            value={draft.editPolicy}
            onChange={(event) => set({ editPolicy: event.target.value })}
          >
            {EDIT_POLICIES.map((policy) => (
              <option key={policy.value} value={policy.value}>
                {policy.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="meta-opens-at" label="Opens (ET)">
          <Input
            id="meta-opens-at"
            type="datetime-local"
            value={draft.opensAt}
            onChange={(event) => set({ opensAt: event.target.value })}
          />
        </Field>

        <Field id="meta-closes-at" label="Closes (ET)">
          <Input
            id="meta-closes-at"
            type="datetime-local"
            value={draft.closesAt}
            onChange={(event) => set({ closesAt: event.target.value })}
          />
        </Field>
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <div>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => run(() => updateMeta(form.id, draft))}
        >
          {pending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </section>
  );
}
