import { forms } from "@patriothacks/database";
import { AppShell, Button } from "@patriothacks/ui";

import { requireClaims } from "@/lib/auth";
import { withRls } from "@/lib/db";

import { signOut } from "./actions";

export default async function Home() {
  const claims = await requireClaims();

  // `forms_select_published` is what limits this to published, non-deleted rows.
  const published = await withRls(claims, (tx) =>
    tx.select({ id: forms.id, slug: forms.slug, title: forms.title }).from(forms),
  );

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm">{claims.email}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>

        <ul className="flex flex-col gap-1">
          {published.map((form) => (
            <li key={form.id} className="text-sm">
              {form.title} <span className="text-muted-foreground">/{form.slug}</span>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
