import { BROADCAST_VARIABLES } from "@patriothacks/emails";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { listFormChoices } from "@/lib/broadcasts";
import { listNewsletterChoices } from "@/lib/newsletters";

import { BroadcastComposer } from "./broadcast-composer";

export default async function NewBroadcastPage() {
  await requireAdmin();
  const [forms, newsletters] = await Promise.all([listFormChoices(), listNewsletterChoices()]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link href="/emails/broadcasts" className="text-sm text-muted-foreground hover:underline">
          ← Broadcasts
        </Link>
        <h1 className="mt-2 text-xl font-semibold">New broadcast</h1>
        <p className="text-sm text-muted-foreground">
          Announcements, not decisions. Anyone on the unsubscribe list is excluded.
        </p>
      </div>

      <BroadcastComposer forms={forms} newsletters={newsletters} variables={BROADCAST_VARIABLES} />
    </div>
  );
}
