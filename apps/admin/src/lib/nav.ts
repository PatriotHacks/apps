import { type StaffRole } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  /** Hidden from organizers. The page behind it guards itself as well. */
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/forms", label: "Forms" },
  { href: "/forms/new", label: "New form", adminOnly: true },
];

export function navItemsFor(role: StaffRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
}
