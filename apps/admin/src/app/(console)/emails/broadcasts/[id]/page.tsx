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
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { describeAudience } from "@/lib/broadcast-audience";
import { getBroadcast } from "@/lib/broadcasts";
import { formatDateTime } from "@/lib/format";

import { BroadcastStatusBadge } from "../broadcast-status-badge";
import { SendPanel } from "./send-panel";

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const broadcast = await getBroadcast(id);
  if (!broadcast) notFound();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link href="/emails/broadcasts" className="text-sm text-muted-foreground hover:underline">
          ← Broadcasts
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold">
          {broadcast.name}
          <BroadcastStatusBadge status={broadcast.status} />
        </h1>
        <p className="text-sm text-muted-foreground">
          {broadcast.subject} · created {formatDateTime(broadcast.createdAt)}
          {broadcast.sentAt ? ` · finished ${formatDateTime(broadcast.sentAt)}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Send</h2>
          <SendPanel
            id={broadcast.id}
            status={broadcast.status}
            recipientCount={broadcast.recipientCount}
            sent={broadcast.sentCount}
            failed={broadcast.failedCount}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Audience</h2>
          <ul className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
            {describeAudience(broadcast.filter, broadcast.formTitle).map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li className="text-muted-foreground">Excludes anyone who has unsubscribed.</li>
          </ul>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Stored filter</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2">
              {JSON.stringify(broadcast.filter, null, 2)}
            </pre>
          </details>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          Recipients ({broadcast.sends.length} attempted, {broadcast.sentCount} sent,{" "}
          {broadcast.failedCount} failed)
        </h2>

        {broadcast.sends.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been attempted yet.</p>
        ) : (
          <DataList
            rows={broadcast.sends}
            getKey={(send) => `${send.toEmail}-${send.createdAt.toISOString()}`}
            card={(send) => (
              <div className="flex flex-col gap-1">
                <span className="text-sm break-all">{send.toEmail}</span>
                <span
                  className={
                    send.status === "failed"
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {send.status} · {formatDateTime(send.sentAt ?? send.createdAt)}
                </span>
                {send.error ? (
                  <span className="text-xs break-words text-muted-foreground">{send.error}</span>
                ) : null}
              </div>
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Attempted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcast.sends.map((send) => (
                  <TableRow key={`${send.toEmail}-${send.createdAt.toISOString()}`}>
                    <TableCell className="break-all">{send.toEmail}</TableCell>
                    <TableCell
                      className={send.status === "failed" ? "text-destructive" : undefined}
                    >
                      {send.status}
                    </TableCell>
                    <TableCell className="max-w-64 text-xs break-words text-muted-foreground">
                      {send.error ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDateTime(send.sentAt ?? send.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataList>
        )}
      </section>
    </div>
  );
}
