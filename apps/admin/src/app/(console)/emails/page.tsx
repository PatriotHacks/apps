import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";

/** The section's nav entry. Templates is where it opens. */
export default async function EmailsPage() {
  await requireAdmin();
  redirect("/emails/templates");
}
