import { AppShell, Badge, Button, ThemeToggle } from "@patriothacks/ui";
import Link from "next/link";

import { signOut } from "@/app/actions";
import { ConsoleNav } from "@/components/console-nav";
import { type Staff } from "@/lib/auth";
import { navItemsFor } from "@/lib/nav";

export function ConsoleShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  return (
    <AppShell
      header={
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Link href="/forms" className="text-sm font-semibold">
            PatriotHacks Console
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{staff.email}</span>
            <Badge variant="secondary">{staff.role}</Badge>
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      }
      sidebar={<ConsoleNav items={navItemsFor(staff.role)} />}
    >
      {children}
    </AppShell>
  );
}
