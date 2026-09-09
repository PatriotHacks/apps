"use client";

import { cn } from "@patriothacks/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeHref, type NavItem } from "@/lib/nav";

/** Secondary nav for a section that owns several pages. */
export function ConsoleTabs({ items, label }: { items: NavItem[]; label: string }) {
  const active = activeHref(usePathname(), items);

  return (
    <nav aria-label={label} className="flex gap-4 overflow-x-auto border-b px-4 sm:px-6">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 py-3 text-sm whitespace-nowrap",
            item.href === active
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
