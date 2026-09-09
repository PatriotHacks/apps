import { requireAdmin } from "@/lib/auth";

export default async function NewslettersPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Newsletter</h1>
        <p className="text-sm text-muted-foreground">
          Subscribers and the issues sent to them.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">Nothing here yet.</p>
    </div>
  );
}
