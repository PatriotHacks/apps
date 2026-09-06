import { admins, createDrizzleSupabaseClient } from "@patriothacks/database";
import { eq } from "drizzle-orm";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type StaffRole = (typeof admins.role.enumValues)[number];

export type Staff = {
  userId: string;
  email: string | undefined;
  role: StaffRole;
};

/**
 * Verified claims for the current request. Cached so the layout guard, a page
 * guard and every query in one render share a single verification.
 */
export const requireClaims = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect("/login");
  return data.claims;
});

/** Gate for every console page: a verified session plus a row in `admins`. */
export const requireStaff = cache(async (): Promise<Staff> => {
  const claims = await requireClaims();

  const db = createDrizzleSupabaseClient(claims);
  try {
    // Service-role connection, RLS bypassed. Gated by: middleware has already
    // refused anyone without an `admins` row (checked under the
    // `admins_select_own` policy), and this query is the server-side re-check,
    // scoped to the caller's own row. Everything else in the console runs
    // behind it.
    const [membership] = await db.admin
      .select({ role: admins.role })
      .from(admins)
      .where(eq(admins.userId, claims.sub))
      .limit(1);

    if (!membership) redirect("/login?error=not_authorized");

    return { userId: claims.sub, email: claims.email, role: membership.role };
  } finally {
    await db.end();
  }
});

/**
 * Gate for admin-only pages. An organizer who types the URL gets a 403 from the
 * server; hiding the nav link is presentation, this is the boundary.
 */
export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") forbidden();
  return staff;
}
