import { validateFormGraph } from "@patriothacks/form-engine";
import { Button } from "@patriothacks/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";
import { loadFormDefinition } from "@/lib/form-definition";

import { Builder } from "./builder";

/**
 * Editing exists only for a draft. The check is here rather than in the client
 * because a published form is immutable: no builder is rendered for one, and
 * every mutation re-checks the status inside its own transaction so a page left
 * open across a publish cannot write either.
 */
export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const loaded = await queryAsStaff((tx) => loadFormDefinition(tx, id));
  if (!loaded) notFound();

  const { form, definition } = loaded;

  if (form.status !== "draft") {
    return (
      <div className="flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">This form cannot be edited</h1>
        <p className="text-sm text-muted-foreground">
          {form.title} is {form.status}. A published form is immutable — its sections, questions,
          options and branch targets are frozen for good, because applicants have already answered
          against this exact shape. To ask something different, create a new form.
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href={`/forms/${form.id}`}>View the form</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/forms/new">New form</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Builder form={form} definition={definition} errors={validateFormGraph(definition).errors} />
  );
}
