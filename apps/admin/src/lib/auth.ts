import { admins, createDrizzleSupabaseClient } from "@patriothacks/database";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Gate for every console page: a verified session plus a row in `admins`. */
export async function requireStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect("/login");

  const db = createDrizzleSupabaseClient(data.claims);
  try {
    // Service-role connection, RLS bypassed. Gated by: middleware has already
    // refused anyone without an `admins` row (checked under the
    // `admins_select_own` policy), and this query is the server-side re-check,
    // scoped to the caller's own row. Everything else in the console runs
    // behind it.
    const [membership] = await db.admin
      .select({ role: admins.role })
      .from(admins)
      .where(eq(admins.userId, data.claims.sub))
      .limit(1);

    if (!membership) redirect("/login?error=not_authorized");

    return { email: data.claims.email, role: membership.role };
  } finally {
    await db.end();
  }
}
