import { forms, submissions } from "@patriothacks/database";
import { AppShell, Button } from "@patriothacks/ui";
import { and, eq } from "drizzle-orm";
import Link from "next/link";

import { requireClaims } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { SUBMISSION_STATUS_LABELS } from "@/lib/editability";

import { signOut } from "./actions";

export default async function Home() {
  const claims = await requireClaims();

  // `forms_select_published` is what limits this to published, non-deleted rows.
  // The left join carries this user's own submission, so the index says where
  // they left off rather than just what exists.
  const rows = await withRls(claims, (tx) =>
    tx
      .select({
        id: forms.id,
        slug: forms.slug,
        title: forms.title,
        status: submissions.status,
      })
      .from(forms)
      .leftJoin(
        submissions,
        and(eq(submissions.formId, forms.id), eq(submissions.userId, claims.sub)),
      ),
  );

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm">{claims.email}</p>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/submissions">Your submissions</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>

        <ul className="flex flex-col divide-y rounded-md border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{row.title}</span>
                <span className="text-xs text-muted-foreground">
                  {row.status === null ? "Not started" : SUBMISSION_STATUS_LABELS[row.status]}
                </span>
              </div>
              <Link href={`/${row.slug}`} className="text-sm underline underline-offset-4">
                {row.status === null ? "Start" : row.status === "draft" ? "Continue" : "View"}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
