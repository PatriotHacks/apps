import { TEMPLATE_LABELS, variablesFor } from "@patriothacks/emails";
import {
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
import { listTemplates } from "@/lib/email-templates";
import { formatDateTime } from "@/lib/format";

export default async function EmailTemplatesPage() {
  await requireAdmin();
  const templates = await listTemplates();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Email templates</h1>
        <p className="text-sm text-muted-foreground">
          The words applicants read. The layout around them is fixed.
        </p>
      </div>

      <DataList
        rows={templates}
        getKey={(template) => template.key}
        card={(template) => (
          <Link href={`/emails/templates/${template.key}`} className="flex flex-col gap-1">
            <span className="font-medium">{TEMPLATE_LABELS[template.key]}</span>
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
            {templates.map((template) => (
              <TableRow key={template.key}>
                <TableCell>
                  <Link
                    href={`/emails/templates/${template.key}`}
                    className="font-medium hover:underline"
                  >
                    {TEMPLATE_LABELS[template.key]}
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
            ))}
          </TableBody>
        </Table>
      </DataList>
    </div>
  );
}
