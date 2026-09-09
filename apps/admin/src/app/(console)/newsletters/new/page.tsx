import { BROADCAST_VARIABLES } from "@patriothacks/emails";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { starterBlocks } from "@/lib/blocks";

import { NewsletterBuilder } from "../newsletter-builder";

export default async function NewNewsletterPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link href="/newsletters" className="text-sm text-muted-foreground hover:underline">
          ← Newsletters
        </Link>
        <h1 className="mt-2 text-xl font-semibold">New newsletter</h1>
        <p className="text-sm text-muted-foreground">
          Blocks, not markup. Nothing is sent from here — a broadcast loads the result.
        </p>
      </div>

      <NewsletterBuilder
        newsletterId={null}
        initial={{ name: "", blocks: starterBlocks() }}
        variables={BROADCAST_VARIABLES}
      />
    </div>
  );
}
