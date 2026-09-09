import { requireStaff } from "@/lib/auth";

export default async function DesignsPage() {
  await requireStaff();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Designs</h1>
        <p className="text-sm text-muted-foreground">Design assets for the event.</p>
      </div>

      <p className="text-sm text-muted-foreground">Nothing here yet.</p>
    </div>
  );
}
