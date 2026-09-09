"use client";

import { formatFileSize } from "@patriothacks/form-engine";
import { Button, Input, Label, Textarea } from "@patriothacks/ui";
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

/**
 * The file goes browser-to-storage on the admin's own session, and only then
 * does the server action write the row.
 *
 * Two consequences worth knowing. Storage RLS is what authorizes the upload, so
 * an organizer who somehow reaches this is refused by the database rather than
 * by the missing button. And the id is minted here, before either half runs,
 * because it names the object's folder — which is also why a failed insert has
 * to take the object back out: nothing else would ever name it again.
 */
export function AddDesign() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"uploading" | "saving" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function fail(text: string) {
    setBusy(null);
    setMessage(text);
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
      const result = await addDesign({ id, title, description, linkUrl, upload });
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
    setTitle("");
    setDescription("");
    setLinkUrl("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4 rounded-md border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">Add design</h2>
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
        <Label htmlFor="design-description">Description</Label>
        <Textarea
          id="design-description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
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

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <div>
        <Button type="button" size="sm" disabled={busy !== null} onClick={onSubmit}>
          {busy === "uploading" ? "Uploading…" : busy === "saving" ? "Saving…" : "Add design"}
        </Button>
      </div>
    </div>
  );
}
