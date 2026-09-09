"use client";

import { Button, Input, Label } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { NewsletterBlock } from "@patriothacks/emails";

import { BlockList, BlockPreview, VariablesPanel } from "@/components/block-editor";
import { type BlockPreviewResult } from "@/lib/blocks";

import {
  createNewsletter,
  previewNewsletter,
  removeNewsletter,
  saveNewsletter,
  type NewsletterDraft,
} from "./actions";

type Notice = { tone: "ok" | "bad"; message: string };

/** Long enough that a paragraph settles before a request goes out. */
const PREVIEW_DELAY_MS = 400;

export function NewsletterBuilder({
  newsletterId,
  initial,
  variables,
}: {
  newsletterId: string | null;
  initial: NewsletterDraft;
  /** Passed from the server so the emails package — and the `pg` driver behind
      it — never reaches the browser bundle. */
  variables: readonly string[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<NewsletterDraft>(initial);
  const [preview, setPreview] = useState<BlockPreviewResult | null>(null);
  const [rendering, startRendering] = useTransition();
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Compiled on the server after the typing settles. The compiler and the layout
  // shell both live in `@patriothacks/emails`, so the preview is a round trip by
  // design rather than by accident.
  useEffect(() => {
    let current = true;

    const timer = setTimeout(() => {
      startRendering(async () => {
        const result = await previewNewsletter(draft);
        if (current) setPreview(result);
      });
    }, PREVIEW_DELAY_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [draft]);

  function edit(next: Partial<NewsletterDraft>) {
    setDraft((current) => ({ ...current, ...next }));
    setNotice(null);
  }

  const setBlocks = (blocks: NewsletterBlock[]) => edit({ blocks });

  async function onSave() {
    setBusy("save");
    const result = newsletterId
      ? await saveNewsletter(newsletterId, draft)
      : await createNewsletter(draft);
    setBusy(null);

    if (result.status === "created") {
      router.push(`/newsletters/${result.id}`);
      return;
    }

    setNotice(
      result.status === "saved"
        ? { tone: "ok", message: "Saved." }
        : { tone: "bad", message: result.message },
    );
  }

  async function onDelete() {
    if (!newsletterId) return;

    setConfirmingDelete(false);
    setBusy("delete");
    const result = await removeNewsletter(newsletterId);
    setBusy(null);

    if (result.status === "deleted") router.push("/newsletters");
    else setNotice({ tone: "bad", message: result.message });
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex max-w-2xl flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="October issue"
            value={draft.name}
            onChange={(event) => edit({ name: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">Internal only — readers never see it.</p>
        </div>

        <VariablesPanel
          variables={variables}
          note="Write one into any block and the broadcast fills it at send time. Anything else is rejected on save."
        />

        <BlockList blocks={draft.blocks} onChange={setBlocks} />

        {notice ? (
          <p
            className={
              notice.tone === "ok" ? "text-sm text-muted-foreground" : "text-sm text-destructive"
            }
          >
            {notice.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onSave} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : newsletterId ? "Save" : "Create newsletter"}
          </Button>

          {newsletterId && !confirmingDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={busy !== null}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete newsletter
            </Button>
          ) : null}
        </div>

        {newsletterId && confirmingDelete ? (
          <div className="flex flex-col gap-2 rounded-md border-2 border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-semibold text-destructive">Delete this newsletter?</p>
            <p className="text-sm text-destructive/90">
              Broadcasts that already loaded it keep their own copy of the body, so nothing sent or
              queued changes. The design itself is gone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy !== null}
                onClick={onDelete}
              >
                Delete it
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => setConfirmingDelete(false)}
              >
                Keep it
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <BlockPreview result={preview} rendering={rendering} title="Newsletter preview" />
    </div>
  );
}
