import { variablesFor } from "@patriothacks/emails";
import {
  Button,
  DataList,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@patriothacks/ui";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { listTemplates, type StoredTemplateRow } from "@/lib/email-templates";
import { formatDateTime } from "@/lib/format";

const GROUP_LABELS: Record<StoredTemplateRow["kind"], string> = {
  builtin: "Built in",
  custom: "Yours",
};

export default async function EmailTemplatesPage() {
  await requireAdmin();
  const templates = await listTemplates();

  const builtIn = templates.filter((template) => template.kind === "builtin");
  const custom = templates.filter((template) => template.kind === "custom");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Email templates</h1>
          <p className="text-sm text-muted-foreground">
            The words applicants read. The layout around them is fixed.
          </p>
        </div>

        <Button asChild size="sm">
          <Link href="/emails/templates/new">New template</Link>
        </Button>
      </div>

      <DataList
        rows={templates}
        getKey={(template) => template.key}
        card={(template) => (
          <Link href={`/emails/templates/${template.key}`} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{GROUP_LABELS[template.kind]}</span>
            <span className="font-medium break-words">{template.label}</span>
            <span className="text-sm text-muted-foreground">{template.subject}</span>
            <span className="text-xs text-muted-foreground">
              Updated {formatDateTime(template.updatedAt)}
            </span>
          </Link>
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            <GroupRow label={GROUP_LABELS.builtin} />
            {builtIn.map((template) => (
              <TemplateRow key={template.key} template={template} />
            ))}

            <GroupRow label={GROUP_LABELS.custom} />
            {custom.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No templates of your own yet.
                </TableCell>
              </TableRow>
            ) : null}
            {custom.map((template) => (
              <TemplateRow key={template.key} template={template} />
            ))}
          </TableBody>
        </Table>
      </DataList>
    </div>
  );
}

/** The two kinds stay in one table: same columns, same link, one heading row apart. */
function GroupRow({ label }: { label: string }) {
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={4} className="text-xs font-medium text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function TemplateRow({ template }: { template: StoredTemplateRow }) {
  return (
    <TableRow>
      <TableCell>
        <Link href={`/emails/templates/${template.key}`} className="font-medium hover:underline">
          {template.label}
        </Link>
        <p className="text-xs text-muted-foreground">{template.key}</p>
      </TableCell>
      <TableCell className="text-muted-foreground">{template.subject}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {variablesFor(template.key).length}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {formatDateTime(template.updatedAt)}
      </TableCell>
    </TableRow>
  );
}
