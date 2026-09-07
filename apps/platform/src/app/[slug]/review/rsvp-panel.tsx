"use client";

import { Button } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDate } from "@/lib/editability";

import { respondToRsvp, type RsvpResponse } from "./actions";

/**
 * Confirm or decline a spot. Shown only on an accepted application, and the
 * action re-checks that — the button being on screen is not what makes the
 * answer valid.
 */
export function RsvpPanel({
  slug,
  rsvpStatus,
  rsvpAt,
}: {
  slug: string;
  rsvpStatus: "pending" | "confirmed" | "declined" | null;
  rsvpAt: Date | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<RsvpResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const answered = rsvpStatus === "confirmed" || rsvpStatus === "declined";

  async function onRespond(response: RsvpResponse) {
    setBusy(response);
    const result = await respondToRsvp(slug, response);
    setBusy(null);
    if (result.status === "error") {
      setNotice(result.message);
      setFailed(null);
      return;
    }
    setNotice(
      result.response === "confirmed" ? "Your spot is confirmed." : "Your spot has been released.",
    );
    setFailed(result.emailFailed);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <div>
        <h2 className="font-medium">You&apos;re in</h2>
        <p className="text-sm text-muted-foreground">
          {answered
            ? `You ${rsvpStatus === "confirmed" ? "confirmed" : "declined"}${
                rsvpAt ? ` on ${formatDate(rsvpAt)}` : ""
              }. You can change your answer.`
            : "Let the organizers know whether to hold your spot."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy !== null}
          variant={rsvpStatus === "confirmed" ? "default" : "outline"}
          onClick={() => onRespond("confirmed")}
        >
          {busy === "confirmed" ? "Saving…" : "Confirm my spot"}
        </Button>
        <Button
          size="sm"
          disabled={busy !== null}
          variant={rsvpStatus === "declined" ? "default" : "outline"}
          onClick={() => onRespond("declined")}
        >
          {busy === "declined" ? "Saving…" : "I can't make it"}
        </Button>
      </div>

      {notice ? <p className="text-sm">{notice}</p> : null}
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Your answer is saved. The confirmation email did not go out ({failed}) — the organizers
          can see that and will follow up.
        </p>
      ) : null}
    </section>
  );
}
