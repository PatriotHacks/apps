import { AppShell, ThemeToggle } from "@patriothacks/ui";
import Image from "next/image";
import Link from "next/link";

import { ConsoleMenu } from "@/components/console-nav";
import { ConsoleSidebar } from "@/components/console-sidebar";
import { type Staff } from "@/lib/auth";

/**
 * `--console-header-h` is the header's outer height, border included. The
 * sidebar offsets and sizes itself against it, so the two stay in step from one
 * declaration.
 *
 * Below `md` the sidebar strip is dropped and the same `ConsoleSidebar` is
 * rendered inside the header menu instead — two rows of chrome become one.
 */
export function ConsoleShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  return (
    <AppShell
      className="[--console-header-h:calc(3.5rem+1px)] max-md:[&_[data-slot=app-shell-sidebar]]:hidden"
      header={
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/forms" className="flex min-w-0 items-center gap-2">
            {/* Sized by height with width auto so the intrinsic ratio holds. */}
            <Image src="/logo.png" alt="" width={1803} height={1274} priority className="h-8 w-auto" />
            <span className="truncate text-sm font-semibold tracking-tight">PatriotHacks Console</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <ConsoleMenu>
              <ConsoleSidebar staff={staff} />
            </ConsoleMenu>
          </div>
        </div>
      }
      sidebar={<ConsoleSidebar staff={staff} />}
    >
      {children}
    </AppShell>
  );
}
