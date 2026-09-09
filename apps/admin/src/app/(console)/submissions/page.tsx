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
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Submissions</h1>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "submission" : "submissions"} across {rows.length}{" "}
          {rows.length === 1 ? "form" : "forms"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground md:hidden">No forms yet.</p>
      ) : null}

      <DataList
        rows={rows}
        getKey={(row) => row.id}
        card={(row) => (
          <Link href={`/submissions/${row.id}`} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium break-words">{row.title}</span>
              <StatusBadge status={row.status} />
            </div>
            <span className="text-xs text-muted-foreground">/{row.slug}</span>
            <span className="text-xs text-muted-foreground">
              {formatWindow(row.opensAt, row.closesAt)}
            </span>
            <span className="text-sm">
              {row.submissionCount} {row.submissionCount === 1 ? "submission" : "submissions"}
            </span>
          </Link>
        )}
      >
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
      </DataList>
    </div>
  );
}
