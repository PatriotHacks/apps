import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@patriothacks/ui";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listNewsletters } from "@/lib/newsletters";

export default async function NewslettersPage() {
  await requireAdmin();
  const rows = await listNewsletters();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Newsletters</h1>
          <p className="text-sm text-muted-foreground">
            Designs, not sends. A broadcast loads one and mails it.
          </p>
        </div>

        <Button asChild size="sm">
          <Link href="/newsletters/new">New newsletter</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Newsletter</TableHead>
            <TableHead className="text-right">Blocks</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                No newsletters yet.
              </TableCell>
            </TableRow>
          ) : null}

          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/newsletters/${row.id}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.blockCount}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(row.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
