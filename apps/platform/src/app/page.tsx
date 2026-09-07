import { forms, submissions } from "@patriothacks/database";
import { AppShell, Button } from "@patriothacks/ui";
import { and, eq } from "drizzle-orm";
import Link from "next/link";

import { optionalClaims } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { SUBMISSION_STATUS_LABELS } from "@/lib/editability";

import { signOut } from "./actions";

/** Enough of a session to read the list as `anon` when nobody is signed in. */
const ANON = { role: "anon" } as const;

export default async function Home() {
  const claims = await optionalClaims();

  // `forms_select_published` limits a signed-in read to published, non-deleted
  // rows; `forms_select_anon` does the same for a signed-out one, and grants
  // nothing else — a visitor can see a form exists without seeing its questions.
  // The join only means anything with a user to join against.
  const rows = claims
    ? await withRls(claims, (tx) =>
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
      )
    : await withRls(ANON, (tx) =>
        tx
          .select({ id: forms.id, slug: forms.slug, title: forms.title })
          .from(forms)
          .then((list) => list.map((row) => ({ ...row, status: null }))),
      );

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <div className="flex items-center justify-between gap-4">
          {claims ? (
            <>
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
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in to apply. You can see what is open without an account.
              </p>
              <Button asChild size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">
            Nothing is open right now.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{row.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {claims
                      ? row.status === null
                        ? "Not started"
                        : SUBMISSION_STATUS_LABELS[row.status]
                      : "Open"}
                  </span>
                </div>
                {/* Signed out this goes to /login, which returns here after. The
                    middleware would redirect anyway; saying so up front is honest. */}
                <Link
                  href={claims ? `/${row.slug}` : `/login?next=${encodeURIComponent(`/${row.slug}`)}`}
                  className="text-sm underline underline-offset-4"
                >
                  {!claims
                    ? "Sign in to apply"
                    : row.status === null
                      ? "Start"
                      : row.status === "draft"
                        ? "Continue"
                        : "View"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
