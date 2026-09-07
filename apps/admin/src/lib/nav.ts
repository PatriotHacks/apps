import { type StaffRole } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  /** Hidden from organizers. The page behind it guards itself as well. */
  adminOnly?: boolean;
};

/** Top-level sections. One entry per section, never one per page. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/forms", label: "Forms" },
  { href: "/emails", label: "Email", adminOnly: true },
];

/** Secondary nav inside the email section, rendered by its layout. */
export const EMAIL_TABS: NavItem[] = [
  { href: "/emails/templates", label: "Templates" },
  { href: "/emails/broadcasts", label: "Broadcasts" },
];

export function navItemsFor(role: StaffRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
}

/**
 * Which entry a path belongs to. Longest match wins, so a nested section beats
 * the shallower one it sits under.
 */
export function activeHref(pathname: string, items: NavItem[]): string | undefined {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
