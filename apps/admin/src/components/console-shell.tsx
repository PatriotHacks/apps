import { AppShell, ThemeToggle } from "@patriothacks/ui";
import Image from "next/image";
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
          <Link href="/forms" className="flex items-center gap-2">
            {/* Sized by height with width auto so the intrinsic ratio holds. */}
            <Image src="/logo.png" alt="" width={1803} height={1274} priority className="h-8 w-auto" />
            <span className="text-sm font-semibold tracking-tight">PatriotHacks Console</span>
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
