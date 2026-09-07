import { AppShell } from "@patriothacks/ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireClaims } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { SUBMISSION_STATUS_LABELS, formatDate } from "@/lib/editability";
import { loadForm, loadSubmission } from "@/lib/form-data";

import { ReadOnlyAnswers } from "../read-only-answers";

import { RsvpPanel } from "./rsvp-panel";

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const claims = await requireClaims();

  const data = await withRls(claims, async (tx) => {
    const loaded = await loadForm(tx, slug);
    if (loaded === null) return null;
    return { ...loaded, existing: await loadSubmission(tx, loaded.form.id, claims.sub) };
  });
  if (data === null) notFound();

  const { form, definition, existing } = data;
  // Nothing to review until it has been submitted; the fill page is the
  // right place for a draft.
  if (existing === null || existing.submission.status === "draft") redirect(`/${slug}`);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
        <div className="flex flex-col gap-2">
          <Link href="/submissions" className="text-sm text-muted-foreground underline underline-offset-4">
            All submissions
          </Link>
          <h1 className="text-2xl font-semibold">{form.title}</h1>
          <p className="text-sm text-muted-foreground">
            {SUBMISSION_STATUS_LABELS[existing.submission.status]}
            {existing.submission.submittedAt
              ? ` on ${formatDate(existing.submission.submittedAt)}`
              : ""}
          </p>
          {form.editPolicy === "locked" ? null : (
            <Link href={`/${slug}`} className="text-sm underline underline-offset-4">
              Edit the answers the organizers left open
            </Link>
          )}
        </div>

        {existing.submission.status === "accepted" ? (
          <RsvpPanel
            slug={slug}
            rsvpStatus={existing.submission.rsvpStatus}
            rsvpAt={existing.submission.rsvpAt}
          />
        ) : null}

        <ReadOnlyAnswers definition={definition} answers={existing.answers} />
      </div>
    </AppShell>
  );
}
