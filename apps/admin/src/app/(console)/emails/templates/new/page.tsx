import { variablesForCustom } from "@patriothacks/emails";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { starterBlocks } from "@/lib/blocks";

import { TemplateBuilder } from "../template-builder";

export default async function NewEmailTemplatePage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link href="/emails/templates" className="text-sm text-muted-foreground hover:underline">
          ← Email templates
        </Link>
        <h1 className="mt-2 text-xl font-semibold">New template</h1>
        <p className="text-sm text-muted-foreground">
          Blocks, not markup. A broadcast sends it — nothing is mailed from here.
        </p>
      </div>

      <TemplateBuilder
        templateKey={null}
        initial={{ name: "", subject: "", blocks: starterBlocks() }}
        variables={variablesForCustom()}
      />
    </div>
  );
}
