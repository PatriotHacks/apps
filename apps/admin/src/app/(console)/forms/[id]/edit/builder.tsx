"use client";

import type { Form } from "@patriothacks/database";
import type { FormDefinition, GraphError } from "@patriothacks/form-engine";
import { Button } from "@patriothacks/ui";
import Link from "next/link";
import { useState } from "react";

import { sectionLabel } from "@/lib/format";

import { addSection } from "./actions";
import { useAction } from "./controls";
import { LiveFormWarning } from "./live-warning";
import { MetaEditor } from "./meta-editor";
import { Preview } from "./preview";
import { PublishPanel } from "./publish-panel";
import { SectionEditor } from "./section-editor";

/**
 * One column of cards, one of them focused.
 *
 * Every control a card owns used to be on screen for every card at once, which
 * made a ten-question form a wall of inputs with no way to tell what you were
 * looking at. Only the focused card opens up; the rest render as what they
 * describe. Focus is a single id held here rather than per card, because two
 * cards open at once is the state this is meant to avoid — clicking the
 * background puts it back to none.
 */
export function Builder({
  form,
  definition,
  submissionCount,
  answerCounts,
  errors,
}: {
  form: Form;
  definition: FormDefinition;
  submissionCount: number;
  answerCounts: Record<string, number>;
  errors: GraphError[];
}) {
  const { pending, run } = useAction();
  const [focused, setFocused] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const sections = [...definition.sections].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-6 p-6" onClick={() => setFocused(null)}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{form.title}</h1>
            <p className="text-sm text-muted-foreground">
              {form.status === "draft" ? "Draft" : "Live"} — /{form.slug}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPreviewing((on) => !on)}>
              {previewing ? "Hide preview" : "Preview"}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/forms/${form.id}`}>Read-only view</Link>
            </Button>
          </div>
        </div>

        <LiveFormWarning status={form.status} submissionCount={submissionCount} />

        {previewing ? (
          <div className="rounded-lg border bg-card p-4">
            <Preview definition={definition} />
          </div>
        ) : null}

        <MetaEditor form={form} />

        {sections.map((section, index) => (
          <SectionEditor
            key={section.id}
            formId={form.id}
            section={section}
            index={index}
            count={sections.length}
            // Forward-only: a section can only jump to one that comes after it.
            targets={sections.slice(index + 1).map((target) => ({
              id: target.id,
              label: sectionLabel(target.title, target.position),
            }))}
            errors={errors.filter((error) => error.sectionId === section.id)}
            answerCounts={answerCounts}
            focusedId={focused}
            onFocus={setFocused}
          />
        ))}

        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This form has no sections yet. A form needs at least one to be published.
          </p>
        ) : null}

        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => addSection(form.id))}
          >
            Add section
          </Button>
        </div>

        {form.status === "draft" ? (
          <PublishPanel formId={form.id} slug={form.slug} errors={errors} />
        ) : null}
      </div>
    </div>
  );
}
