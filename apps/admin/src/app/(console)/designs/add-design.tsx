"use client";

import { formatFileSize } from "@patriothacks/form-engine";
import { Button, Input, Label } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  ACCEPTED_MIME_TYPES,
  DESIGNS_BUCKET,
  MAX_UPLOAD_BYTES,
  normalizeFileName,
  objectPath,
} from "@/lib/design-files";
import { createClient } from "@/lib/supabase/client";

import { addDesign } from "./actions";

const HEADING_ID = "add-design-heading";

/**
 * The file goes browser-to-storage on the admin's own session, and only then
 * does the server action write the row.
 *
 * Two consequences worth knowing. Storage RLS is what authorizes the upload, so
 * an organizer who somehow reaches this is refused by the database rather than
 * by the missing button. And the id is minted here, before either half runs,
 * because it names the object's folder — which is also why a failed insert has
 * to take the object back out: nothing else would ever name it again.
 *
 * The form lives in a native `<dialog>` opened with `showModal()`, which is
 * where the focus trap, Escape and the backdrop come from rather than from
 * anything written here. What is written here is the one refusal: nothing
 * dismisses the dialog while a call is in flight, because a dialog that
 * vanished mid-upload would take both the error and the cleanup with it.
 */
export function AddDesign() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"uploading" | "saving" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function fail(text: string) {
    setBusy(null);
    setMessage(text);
  }

  /** Every close route ends here, so reopening is a form rather than a retry. */
  function reset() {
    setTitle("");
    setLinkUrl("");
    setFile(null);
    setMessage(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onSubmit() {
    setMessage(null);

    if (file && file.size > MAX_UPLOAD_BYTES) {
      setMessage(
        `That file is ${formatFileSize(file.size)}. The limit is ${formatFileSize(MAX_UPLOAD_BYTES)}.`,
      );
      return;
    }

    const id = crypto.randomUUID();
    const upload = file
      ? { fileName: normalizeFileName(file.name), mimeType: file.type, sizeBytes: file.size }
      : null;
    const path = upload ? objectPath(id, upload.fileName) : null;
    const storage = createClient().storage.from(DESIGNS_BUCKET);

    try {
      if (file && path) {
        setBusy("uploading");
        const { error } = await storage.upload(path, file, { contentType: file.type });
        // Storage's own words, not a summary of them: "mime type not supported"
        // and "row-level security" are the two answers worth reading verbatim.
        if (error) return fail(error.message);
      }

      setBusy("saving");
      const result = await addDesign({ id, title, linkUrl, upload });
      if (!result.ok) {
        // Nothing points at the object now, so nothing ever would.
        if (path) await storage.remove([path]);
        return fail(result.message);
      }
    } catch (cause) {
      // A call that never got an answer failed too, and the object it was meant
      // to record has to come back out either way.
      if (path) await storage.remove([path]);
      return fail(cause instanceof Error ? cause.message : String(cause));
    }

    setBusy(null);
    dialog.current?.close();
    router.refresh();
  }

  return (
    <>
      <div>
        <Button type="button" size="sm" onClick={() => dialog.current?.showModal()}>
          Add design
        </Button>
      </div>

      {/* `m-auto` is what centres a modal dialog: the UA pins all four insets
          and Tailwind's preflight zeroes the auto margins that go with them. */}
      <dialog
        ref={dialog}
        aria-labelledby={HEADING_ID}
        onCancel={(event) => {
          if (busy !== null) event.preventDefault();
        }}
        onClose={reset}
        // The panel's padding sits on the frame inside, so a click that lands
        // on the dialog itself is a click on the backdrop around the panel.
        onClick={(event) => {
          if (busy === null && event.target === event.currentTarget) dialog.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-border bg-background p-0 text-foreground backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div>
            <h2 id={HEADING_ID} className="text-sm font-semibold">
              Add design
            </h2>
            <p className="text-xs text-muted-foreground">
              A file, a link to where the design lives, or both.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="design-title">Title</Label>
            <Input
              id="design-title"
              value={title}
              placeholder="Event poster"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="design-file">File</Label>
            <Input
              id="design-file"
              ref={fileInput}
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(",")}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Images, PDF or ZIP, up to {formatFileSize(MAX_UPLOAD_BYTES)}.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="design-link">Link</Label>
            <Input
              id="design-link"
              value={linkUrl}
              placeholder="https://figma.com/file/…"
              onChange={(event) => setLinkUrl(event.target.value)}
            />
          </div>

          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy !== null} onClick={onSubmit}>
              {busy === "uploading" ? "Uploading…" : busy === "saving" ? "Saving…" : "Add design"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
