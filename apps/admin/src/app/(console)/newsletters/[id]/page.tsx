import { BROADCAST_VARIABLES } from "@patriothacks/emails";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getNewsletter } from "@/lib/newsletters";

import { NewsletterBuilder } from "../newsletter-builder";

export default async function NewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const newsletter = await getNewsletter(id);
  if (!newsletter) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link href="/newsletters" className="text-sm text-muted-foreground hover:underline">
          ← Newsletters
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{newsletter.name}</h1>
        <p className="text-sm text-muted-foreground">
          Updated {formatDateTime(newsletter.updatedAt)}
        </p>
      </div>

      <NewsletterBuilder
        newsletterId={newsletter.id}
        initial={{ name: newsletter.name, blocks: newsletter.blocks }}
        variables={BROADCAST_VARIABLES}
      />
    </div>
  );
}
