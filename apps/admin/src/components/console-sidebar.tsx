import { Badge, Button } from "@patriothacks/ui";

import { signOut } from "@/app/actions";
import { ConsoleNav } from "@/components/console-nav";
import { type Staff } from "@/lib/auth";
import { navItemsFor } from "@/lib/nav";

/**
 * Nav on top, identity and sign-out pinned underneath it.
 *
 * From `md` up this sticks below the header and is exactly one viewport tall,
 * so the nav is the only thing that scrolls and the footer never leaves the
 * bottom-left corner. Below `md` the same markup is the body of the header
 * menu, which is why the footer is a column at every width.
 */
export function ConsoleSidebar({ staff }: { staff: Staff }) {
  return (
    <div className="flex flex-col md:sticky md:top-[var(--console-header-h)] md:h-[calc(100svh-var(--console-header-h))]">
      <ConsoleNav items={navItemsFor(staff.role)} />

      <div className="flex shrink-0 flex-col gap-2 border-t p-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm" title={staff.email}>
            {staff.email}
          </span>
          <Badge variant="secondary" className="shrink-0">
            {staff.role}
          </Badge>
        </div>

        <form action={signOut} className="shrink-0">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
