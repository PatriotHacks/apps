import { TEMPLATE_LABELS, variablesFor } from "@patriothacks/emails";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { getTemplate } from "@/lib/email-templates";
import { formatDateTime } from "@/lib/format";

import { TemplateEditor } from "./template-editor";

export default async function EmailTemplatePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const staff = await requireAdmin();
  const { key } = await params;

  const template = await getTemplate(key);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link href="/emails/templates" className="text-sm text-muted-foreground hover:underline">
          ← Email templates
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{TEMPLATE_LABELS[template.key]}</h1>
        <p className="text-sm text-muted-foreground">
          {template.key} · updated {formatDateTime(template.updatedAt)}
        </p>
      </div>

      <TemplateEditor
        templateKey={template.key}
        variables={[...variablesFor(template.key)]}
        testAddress={staff.email ?? null}
        initial={{
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          bodyText: template.bodyText,
        }}
      />
    </div>
  );
}
