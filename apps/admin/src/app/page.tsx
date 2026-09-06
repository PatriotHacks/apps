import { AppShell, Button } from "@patriothacks/ui";

import { requireStaff } from "@/lib/auth";

import { signOut } from "./actions";

export default async function Home() {
  const { email, role } = await requireStaff();

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm">{email}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>

        <p className="text-sm text-muted-foreground">Role: {role}</p>
      </div>
    </AppShell>
  );
}
