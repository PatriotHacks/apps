import {
  DataList,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@patriothacks/ui";

import { listJudges } from "@/lib/applications";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function JudgesPage() {
  await requireAdmin();
  const rows = await listJudges();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Judges</h1>
        <p className="text-sm text-muted-foreground">
          Applications from the website, newest first.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground md:hidden">No judge applications yet.</p>
      ) : null}

      <DataList
        rows={rows}
        getKey={(row) => row.id}
        card={(row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium break-words">{row.name}</span>
            <span className="text-sm break-all">{row.email}</span>
            <span className="text-sm break-words">
              {row.jobTitle}, {row.company}
            </span>
            <span className="text-sm break-words">{row.expertise}</span>
            <span className="text-xs text-muted-foreground">
              {row.isGmuAlum ? "GMU alum" : "Not a GMU alum"} · {formatDateTime(row.createdAt)}
            </span>
            <p className="text-sm whitespace-pre-wrap break-words">{row.reason}</p>
          </div>
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Job title</TableHead>
              <TableHead>Expertise</TableHead>
              <TableHead>GMU alum</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Applied</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  No judge applications yet.
                </TableCell>
              </TableRow>
            ) : null}

            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.company}</TableCell>
                <TableCell>{row.jobTitle}</TableCell>
                <TableCell className="min-w-48 whitespace-pre-wrap">{row.expertise}</TableCell>
                <TableCell>{row.isGmuAlum ? "Yes" : "No"}</TableCell>
                <TableCell className="min-w-64 whitespace-pre-wrap">{row.reason}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(row.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataList>
    </div>
  );
}
