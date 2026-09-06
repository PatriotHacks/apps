import { requireAdmin } from "@/lib/auth";

export default async function NewFormPage() {
  await requireAdmin();

  return <p className="p-6 text-sm text-muted-foreground">The form builder arrives in the next batch.</p>;
}
