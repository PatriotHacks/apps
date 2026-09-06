"use client";

import { cn } from "@patriothacks/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { type NavItem } from "@/lib/nav";

export function ConsoleNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  // Longest match wins, so /forms/new does not also light up /forms.
  const active = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
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
