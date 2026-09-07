import { AppShell, ThemeToggle } from "@patriothacks/ui";
import Link from "next/link";

import { ConsoleSidebar } from "@/components/console-sidebar";
import { type Staff } from "@/lib/auth";

/**
 * `--console-header-h` is the header's outer height, border included. The
 * sidebar offsets and sizes itself against it, so the two stay in step from one
 * declaration.
 */
export function ConsoleShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  return (
    <AppShell
      className="[--console-header-h:calc(3.5rem+1px)]"
      header={
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <Link href="/forms" className="text-sm font-semibold tracking-tight">
            PatriotHacks Console
          </Link>
          <ThemeToggle />
        </div>
      }
      sidebar={<ConsoleSidebar staff={staff} />}
    >
      {children}
    </AppShell>
  );
}
