"use client";

import { cn } from "@patriothacks/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeHref, type NavItem } from "@/lib/nav";

export function ConsoleNav({ items }: { items: NavItem[] }) {
  const active = activeHref(usePathname(), items);

  return (
    <nav
      aria-label="Console"
      className="flex flex-col gap-1 p-3 md:min-h-0 md:flex-1 md:overflow-y-auto"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-accent hover:text-accent-foreground",
            item.href === active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The phone-sized console menu: nav, identity and sign-out behind one trigger.
 *
 * A `<details>` rather than a popover so there is no open state to hold; the
 * pathname key is the whole of the client logic, closing the panel when a link
 * inside it navigates without remounting the layout.
 */
export function ConsoleMenu({ children }: { children: React.ReactNode }) {
  return (
    <details key={usePathname()} className="relative md:hidden">
      <summary className="flex h-10 cursor-pointer list-none items-center rounded-md px-3 text-sm hover:bg-accent [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 rounded-md border bg-background shadow-md">
        {children}
      </div>
    </details>
  );
}
