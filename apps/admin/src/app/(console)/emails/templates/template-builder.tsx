"use client";

import { Button, Input, Label } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { BlockList, BlockPreview, VariablesPanel } from "@/components/block-editor";
import { type BlockPreviewResult } from "@/lib/blocks";

import { ConfirmDelete } from "../../forms/[id]/edit/controls";
import {
  createCustomTemplate,
  previewCustomTemplate,
  removeCustomTemplate,
  saveCustomTemplate,
  type CustomTemplateDraft,
} from "./actions";

type Notice = { tone: "ok" | "bad"; message: string };

/** Long enough that a paragraph settles before a request goes out. */
const PREVIEW_DELAY_MS = 400;

/**
 * The editor for a template an admin built. Blocks rather than markup, and the
 * same blocks the newsletter designer builds — what differs is that this one
 * owns a subject and a key, and a broadcast picks it by name.
 */
export function TemplateBuilder({
  templateKey,
  initial,
  variables,
}: {
  templateKey: string | null;
  initial: CustomTemplateDraft;
  /** Passed from the server so the emails package — and the `pg` driver behind
      it — never reaches the browser bundle. */
  variables: readonly string[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CustomTemplateDraft>(initial);
  const [preview, setPreview] = useState<BlockPreviewResult | null>(null);
  const [rendering, startRendering] = useTransition();
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let current = true;

    const timer = setTimeout(() => {
      startRendering(async () => {
        const result = await previewCustomTemplate(templateKey, draft);
        if (current) setPreview(result);
      });
    }, PREVIEW_DELAY_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [templateKey, draft]);

  function edit(next: Partial<CustomTemplateDraft>) {
    setDraft((current) => ({ ...current, ...next }));
    setNotice(null);
  }

  async function onSave() {
    setBusy("save");
    const result = templateKey
      ? await saveCustomTemplate(templateKey, draft)
      : await createCustomTemplate(draft);
    setBusy(null);

    if (result.status === "created") {
      router.push(`/emails/templates/${result.key}`);
      return;
    }

    setNotice(
      result.status === "saved"
        ? { tone: "ok", message: "Saved." }
        : { tone: "bad", message: result.message },
    );
  }

  async function onDelete() {
    if (!templateKey) return;

    setBusy("delete");
    const result = await removeCustomTemplate(templateKey);
    setBusy(null);

    if (result.status === "deleted") router.push("/emails/templates");
    else setNotice({ tone: "bad", message: result.message });
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex max-w-2xl flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="Mentor welcome"
            value={draft.name}
            onChange={(event) => edit({ name: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {templateKey
              ? `Internal only. The key stays ${templateKey} however this is renamed, because sent mail records it.`
              : "Internal only — recipients never see it. The key is made from it once, at creation."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={draft.subject}
            onChange={(event) => edit({ subject: event.target.value })}
          />
        </div>

        <VariablesPanel
          variables={variables}
          note="Exactly what a broadcast can supply, which is what makes this template sendable from one. Anything else is rejected on save."
        />

        <BlockList blocks={draft.blocks} onChange={(blocks) => edit({ blocks })} />

        {notice ? (
          <p
            className={
              notice.tone === "ok" ? "text-sm text-muted-foreground" : "text-sm text-destructive"
            }
          >
            {notice.message}
          </p>
        ) : null}

        {/* Top-aligned rather than centred: the confirm panel opens in place of
            the trigger and is taller than the button beside it. */}
        <div className="flex flex-wrap items-start gap-3">
          <Button onClick={onSave} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : templateKey ? "Save" : "Create template"}
          </Button>

          {templateKey ? (
            <ConfirmDelete
              trigger="Delete template"
              heading="Delete this template?"
              confirmLabel="Delete it"
              disabled={busy !== null}
              body={
                <p>
                  Broadcasts that already loaded it keep their own copy of the body, so nothing sent
                  or queued changes. The template itself is gone.
                </p>
              }
              onConfirm={onDelete}
            />
          ) : null}
        </div>
      </div>

      <BlockPreview result={preview} rendering={rendering} title="Template preview" />
    </div>
  );
}
