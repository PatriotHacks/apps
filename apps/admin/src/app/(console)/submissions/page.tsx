import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@patriothacks/ui";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { requireStaff } from "@/lib/auth";
import { formatWindow } from "@/lib/format";
import { listForms } from "@/lib/forms";

/** One row per form: the response grid is per form, so this is the way into it. */
export default async function SubmissionsPage() {
  await requireStaff();
  const rows = await listForms();

  const total = rows.reduce((sum, row) => sum + row.submissionCount, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Submissions</h1>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "submission" : "submissions"} across {rows.length}{" "}
          {rows.length === 1 ? "form" : "forms"}
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Form</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Window</TableHead>
            <TableHead className="text-right">Submissions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No forms yet.
              </TableCell>
            </TableRow>
          ) : null}

          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/submissions/${row.id}`} className="font-medium hover:underline">
                  {row.title}
                </Link>
                <p className="text-xs text-muted-foreground">/{row.slug}</p>
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatWindow(row.opensAt, row.closesAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.submissionCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
