import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";

/** The section's nav entry. Volunteers is where it opens. */
export default async function ApplicationsPage() {
  await requireAdmin();
  redirect("/applications/volunteers");
}
