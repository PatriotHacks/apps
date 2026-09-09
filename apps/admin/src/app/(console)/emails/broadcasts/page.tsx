import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@patriothacks/ui";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { listBroadcasts } from "@/lib/broadcasts";
import { formatDateTime } from "@/lib/format";

import { BroadcastStatusBadge } from "./broadcast-status-badge";

export default async function BroadcastsPage() {
  await requireAdmin();
  const rows = await listBroadcasts();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Broadcasts</h1>
          <p className="text-sm text-muted-foreground">
            Announcements to a filtered audience. Unlike decision mail, these respect the
            unsubscribe list.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/emails/broadcasts/new">New broadcast</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Broadcast</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/emails/broadcasts/${row.id}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.subject}</p>
                </TableCell>
                <TableCell>
                  <BroadcastStatusBadge status={row.status} />
                </TableCell>
                <TableCell>{row.recipientCount}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.sent} sent
                  {row.failed > 0 ? (
                    <Badge variant="destructive" className="ml-2">
                      {row.failed} failed
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(row.sentAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
