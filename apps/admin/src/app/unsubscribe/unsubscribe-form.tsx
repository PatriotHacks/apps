"use client";

import { Button } from "@patriothacks/ui";
import { useState } from "react";

import { confirmUnsubscribe } from "./actions";

export function UnsubscribeForm({
  token,
  email,
  alreadyUnsubscribed,
}: {
  token: string;
  email: string;
  alreadyUnsubscribed: boolean;
}) {
  const [done, setDone] = useState(alreadyUnsubscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    const result = await confirmUnsubscribe(token);
    setBusy(false);
    if (result.status === "unsubscribed") setDone(true);
    else setError("This unsubscribe link is not valid.");
  }

  if (done) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          <strong>{email}</strong> will not receive announcement emails.
        </p>
        <p className="text-sm text-muted-foreground">
          Decision and RSVP emails about your application still go out — those are not
          announcements, and opting out of them is not something we offer.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Stop sending announcement emails to <strong>{email}</strong>?
      </p>
      <p className="text-sm text-muted-foreground">
        Decision and RSVP emails about your application will still be sent.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div>
        <Button onClick={onConfirm} disabled={busy}>
          {busy ? "Unsubscribing…" : "Unsubscribe"}
        </Button>
      </div>
    </div>
  );
}
