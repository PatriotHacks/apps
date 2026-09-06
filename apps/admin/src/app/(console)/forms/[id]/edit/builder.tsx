"use client";

import type { Form } from "@patriothacks/database";
import type { FormDefinition, GraphError } from "@patriothacks/form-engine";
import { Button } from "@patriothacks/ui";
import Link from "next/link";

import { sectionLabel } from "@/lib/format";

import { addSection } from "./actions";
import { useAction } from "./controls";
import { MetaEditor } from "./meta-editor";
import { Preview } from "./preview";
import { PublishPanel } from "./publish-panel";
import { SectionEditor } from "./section-editor";

export function Builder({
  form,
  definition,
  errors,
}: {
  form: Form;
  definition: FormDefinition;
  errors: GraphError[];
}) {
  const { pending, run } = useAction();
  const sections = [...definition.sections].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{form.title}</h1>
          <p className="text-sm text-muted-foreground">Draft — /{form.slug}</p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/forms/${form.id}`}>Read-only view</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex flex-col gap-4">
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
            />
          ))}

          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This form has no sections yet. A form needs at least one to be published.
            </p>
          ) : null}

          <div>
            <Button type="button" size="sm" disabled={pending} onClick={() => run(() => addSection(form.id))}>
              Add section
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <PublishPanel formId={form.id} slug={form.slug} errors={errors} />

          <div className="rounded-lg border p-4">
            <Preview definition={definition} />
          </div>
        </div>
      </div>
    </div>
  );
}
