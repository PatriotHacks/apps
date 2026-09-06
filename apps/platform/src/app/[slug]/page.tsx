import { AppShell } from "@patriothacks/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireClaims } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { SUBMISSION_STATUS_LABELS, windowExplanation, windowState } from "@/lib/editability";
import { loadForm, loadSubmission } from "@/lib/form-data";

import { FillForm } from "./fill-form";
import { ReadOnlyAnswers } from "./read-only-answers";

/** `[slug]` resolves against `forms.slug`, so `/hacker` is data, not a route. */
export default async function FillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const claims = await requireClaims();

  const data = await withRls(claims, async (tx) => {
    const loaded = await loadForm(tx, slug);
    if (loaded === null) return null;
    return { ...loaded, existing: await loadSubmission(tx, loaded.form.id, claims.sub) };
  });
  if (data === null) notFound();

  const { form, definition, existing } = data;
  const state = windowState(form);
  const explanation = windowExplanation(form, state);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
        <div className="flex flex-col gap-2">
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
            All forms
          </Link>
          <h1 className="text-2xl font-semibold">{form.title}</h1>
          {form.description ? (
            <p className="text-sm text-muted-foreground">{form.description}</p>
          ) : null}
          {existing ? (
            <p className="text-sm text-muted-foreground">
              Status: {SUBMISSION_STATUS_LABELS[existing.submission.status]}
            </p>
          ) : null}
        </div>

        {explanation !== null ? (
          <>
            <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">
              {explanation} Your answers are shown below and cannot be changed.
            </p>
            <ReadOnlyAnswers definition={definition} answers={existing?.answers ?? {}} />
          </>
        ) : (
          <FillForm
            slug={form.slug}
            definition={definition}
            editPolicy={form.editPolicy}
            status={existing?.submission.status ?? null}
            initialAnswers={existing?.answers ?? {}}
          />
        )}
      </div>
    </AppShell>
  );
}
