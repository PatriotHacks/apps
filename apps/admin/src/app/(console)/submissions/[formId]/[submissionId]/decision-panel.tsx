"use client";

import { Button } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SubmissionStatusBadge, submissionStatusLabel } from "@/components/submission-status-badge";
import { SETTABLE_STATUSES, type SettableStatus } from "@/lib/decisions";
import { formatDateTime } from "@/lib/format";
import { type SubmissionStatus } from "@/lib/submission-query";

import { sendDecisionEmail, setSubmissionStatus } from "./actions";

export interface LastAttempt {
  status: "queued" | "sent" | "failed" | "bounced";
  error: string | null;
  createdAt: Date;
}

type Notice = { tone: "ok" | "bad"; message: string };

const ACTION_LABEL: Record<SettableStatus, string> = {
  under_review: "Move to review",
  accepted: "Accept",
  waitlisted: "Waitlist",
  rejected: "Reject",
};

/**
 * Decision controls. Rendered for admins; `requireAdmin()` inside both actions
 * is what actually stops an organizer, so this is the convenience half.
 *
 * Deciding and notifying are two buttons on purpose. An admin can work through
 * the pile today and send the mail on Friday, and — more importantly — a
 * provider outage cannot undo a decision it was never part of recording.
 */
export function DecisionPanel({
  formId,
  submissionId,
  status,
  decidedAt,
  decidedByEmail,
  templateLabel,
  lastAttempt,
}: {
  formId: string;
  submissionId: string;
  status: SubmissionStatus;
  decidedAt: Date | null;
  decidedByEmail: string | null;
  /** The template a send would use, or null when there is no decision yet. */
  templateLabel: string | null;
  lastAttempt: LastAttempt | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function onSetStatus(next: SettableStatus) {
    setBusy(next);
    const result = await setSubmissionStatus(formId, submissionId, next);
    setBusy(null);
    if (result.status === "updated") {
      setNotice({ tone: "ok", message: `Status is now ${submissionStatusLabel(next)}.` });
      router.refresh();
    } else {
      setNotice({ tone: "bad", message: result.message });
    }
  }

  async function onSend() {
    setBusy("email");
    const result = await sendDecisionEmail(formId, submissionId);
    setBusy(null);
    setNotice(
      result.status === "sent"
        ? { tone: "ok", message: `Sent to ${result.to}.` }
        : { tone: "bad", message: `Not sent: ${result.message}` },
    );
    // Refreshed on failure too — the attempt is a row in `email_sends`, and the
    // decision below it is untouched either way.
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">Decision</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <SubmissionStatusBadge status={status} />
          {decidedAt ? (
            <span>
              decided {formatDateTime(decidedAt)}
              {decidedByEmail ? ` by ${decidedByEmail}` : ""}
            </span>
          ) : (
            <span>no decision recorded</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SETTABLE_STATUSES.map((target) => (
          <Button
            key={target}
            size="sm"
            variant={target === status ? "default" : "outline"}
            disabled={busy !== null || target === status}
            onClick={() => onSetStatus(target)}
          >
            {busy === target ? "Saving…" : ACTION_LABEL[target]}
          </Button>
        ))}
      </div>

      {templateLabel ? (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-sm font-medium">Notify the applicant</p>
          <p className="text-xs text-muted-foreground">
            Sends “{templateLabel}”. Nothing was sent when the decision was recorded — this is the
            separate act.
          </p>
          <div>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={onSend}>
              {busy === "email" ? "Sending…" : "Send decision email"}
            </Button>
          </div>
          {lastAttempt ? (
            <p
              className={
                lastAttempt.status === "sent"
                  ? "text-xs text-muted-foreground"
                  : "text-xs text-destructive"
              }
            >
              Last attempt {lastAttempt.status} {formatDateTime(lastAttempt.createdAt)}
              {lastAttempt.error ? ` — ${lastAttempt.error}` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Never sent.</p>
          )}
        </div>
      ) : null}

      {notice ? (
        <p
          className={
            notice.tone === "ok" ? "text-sm text-muted-foreground" : "text-sm text-destructive"
          }
        >
          {notice.message}
        </p>
      ) : null}
    </section>
  );
}
