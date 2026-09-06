import { requireAdmin } from "@/lib/auth";

import { NewForm } from "./new-form";

export default async function NewFormPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">New form</h1>
        <p className="text-sm text-muted-foreground">
          Creates a draft. Everything else is editable until you publish.
        </p>
      </div>

      <NewForm />
    </div>
  );
}
