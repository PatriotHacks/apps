"use client";

import { type Broadcast } from "@patriothacks/database";
import { Button } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { BroadcastProgress } from "@/lib/broadcast-send";

import { continueBroadcast, startBroadcast } from "../actions";

/**
 * Drives the send one batch at a time.
 *
 * The loop lives here rather than in the server action because a single request
 * must never carry the whole audience: at 2000 recipients that is a Worker CPU
 * timeout, and a timeout halfway through is the state nobody can account for.
 * Each call mails one batch and returns where things stand; closing the tab
 * stops the loop and leaves a broadcast that resumes from `email_sends`.
 */
export function SendPanel({
  id,
  status,
  recipientCount,
  sent,
  failed,
}: {
  id: string;
  status: Broadcast["status"];
  recipientCount: number;
  sent: number;
  failed: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BroadcastProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(first: () => Promise<Awaited<ReturnType<typeof startBroadcast>>>) {
    setRunning(true);
    setError(null);

    let result = await first();
    while (result.ok) {
      setProgress(result.progress);
      if (result.progress.remaining === 0) break;
      result = await continueBroadcast(id);
    }

    if (!result.ok) setError(result.message);
    setRunning(false);
    router.refresh();
  }

  const live = progress ?? {
    status,
    sent,
    failed,
    remaining: Math.max(recipientCount - sent - failed, 0),
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap gap-6 text-sm">
        <Stat label="Recipients" value={recipientCount} />
        <Stat label="Sent" value={live.sent} />
        <Stat label="Failed" value={live.failed} tone={live.failed > 0 ? "bad" : undefined} />
        <Stat label="Remaining" value={live.remaining} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {status === "draft" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            The audience is resolved when you press send, not when the broadcast was written.
          </p>
          <div>
            <Button onClick={() => run(() => startBroadcast(id))} disabled={running}>
              {running ? "Sending…" : "Send now"}
            </Button>
          </div>
        </div>
      ) : null}

      {status === "sending" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            This send was interrupted. Resuming picks up the recipients with no send row yet — no
            one is mailed twice.
          </p>
          <div>
            <Button onClick={() => run(() => continueBroadcast(id))} disabled={running}>
              {running ? "Sending…" : "Resume"}
            </Button>
          </div>
        </div>
      ) : null}

      {status === "sent" ? (
        <p className="text-sm text-muted-foreground">Finished with no failures.</p>
      ) : null}

      {status === "failed" ? (
        <p className="text-sm text-destructive">
          Finished with failures. Every attempt is listed below with the reason it failed.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" | undefined }) {
  return (
    <div>
      <p className={tone === "bad" ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
