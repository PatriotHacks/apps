"use client";

import { Button, Textarea } from "@patriothacks/ui";
import { useState } from "react";

import { formatDateTime } from "@/lib/format";
import { type ReviewNote } from "@/lib/reviews";

import { saveReviewNote } from "./actions";

/**
 * The notes panel. Everyone reads every note; each reviewer writes exactly one.
 *
 * Somebody else's note has no editor here, and that is presentation only — the
 * action takes no reviewer argument and the `submission_reviews_update_own`
 * policy refuses the write, so the absent textarea is a convenience, not the
 * control.
 */
export function ReviewNotes({
  formId,
  submissionId,
  notes,
  mine,
  reviewerLabel,
}: {
  formId: string;
  submissionId: string;
  notes: ReviewNote[];
  mine: ReviewNote | null;
  reviewerLabel: string;
}) {
  const [draft, setDraft] = useState(mine?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = notes.filter((note) => !note.mine);

  async function onSave() {
    setBusy(true);
    const result = await saveReviewNote(formId, submissionId, draft);
    setBusy(false);
    setError(result.status === "saved" ? null : result.message);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">Review notes</h2>
        <p className="text-xs text-muted-foreground">
          Free-for-all: everyone reviewing this form writes here, and everyone reads all of it.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="review-note" className="text-sm font-medium">
          {mine ? "Your note" : `Add a note as ${reviewerLabel}`}
        </label>
        <Textarea
          id="review-note"
          rows={5}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          placeholder="What stood out, good or bad."
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy ? "Saving…" : mine ? "Update note" : "Save note"}
          </Button>
          {mine ? (
            <span className="text-xs text-muted-foreground">
              Last saved {formatDateTime(mine.updatedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {others.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other reviewer has written here yet.</p>
      ) : (
        <ul className="flex flex-col gap-3 border-t pt-3">
          {others.map((note) => (
            <li key={note.reviewerId} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium">{note.reviewerName ?? note.reviewerEmail}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(note.updatedAt)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.notes}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
