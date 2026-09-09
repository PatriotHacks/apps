import { forms, submissions } from "@patriothacks/database";
import { AppShell } from "@patriothacks/ui";
import { and, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";

import { requireClaims } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { SUBMISSION_STATUS_LABELS, formatDate } from "@/lib/editability";
import { SiteHeader } from "@/components/site-header";

export default async function SubmissionsPage() {
  const claims = await requireClaims();

  // `submissions_select_own` scopes this to the caller; the join to forms is
  // what turns a row into something worth reading.
  const all = await withRls(claims, (tx) =>
    tx
      .select({
        id: submissions.id,
        formId: submissions.formId,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
        updatedAt: submissions.updatedAt,
        slug: forms.slug,
        title: forms.title,
      })
      .from(submissions)
      .innerJoin(forms, and(eq(forms.id, submissions.formId), isNull(forms.deletedAt)))
      .orderBy(desc(submissions.updatedAt)),
  );

  // One row per form — whatever is current. `unique (form_id, user_id)` should
  // already guarantee that, so this is a belt-and-braces pass rather than the
  // thing doing the work: ordered newest first, the first row for a form is the
  // one to keep and any later duplicate is stale.
  const seen = new Set<string>();
  const rows = all.filter((row) => !seen.has(row.formId) && seen.add(row.formId));

  return (
    <AppShell header={<SiteHeader />}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
        <div className="flex flex-col gap-2">
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
            All forms
          </Link>
          <h1 className="text-2xl font-semibold">Your submissions</h1>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not started an application yet.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{row.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {SUBMISSION_STATUS_LABELS[row.status]}
                    {row.submittedAt ? ` on ${formatDate(row.submittedAt)}` : ""}
                  </span>
                </div>
                <Link
                  href={row.status === "draft" ? `/${row.slug}` : `/${row.slug}/review`}
                  className="text-sm underline underline-offset-4"
                >
                  {row.status === "draft" ? "Continue" : "View"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
