import { TEMPLATE_LABELS, variablesFor } from "@patriothacks/emails";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@patriothacks/ui";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { listTemplates } from "@/lib/email-templates";
import { formatDateTime } from "@/lib/format";

export default async function EmailTemplatesPage() {
  await requireAdmin();
  const templates = await listTemplates();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Email templates</h1>
        <p className="text-sm text-muted-foreground">
          The words applicants read. The layout around them is fixed.
        </p>
      </div>

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
              <TableCell className="text-muted-foreground">
                {formatDateTime(template.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
