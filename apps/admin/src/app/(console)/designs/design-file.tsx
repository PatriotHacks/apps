"use client";

import { formatFileSize } from "@patriothacks/form-engine";
import { Button } from "@patriothacks/ui";
import { useState, useTransition } from "react";

import { signDesignUrl } from "./actions";

/**
 * The file's name, its size, and the one way to reach it.
 *
 * The bucket is private, so opening a file means a 60-second signed URL minted
 * on the click. It opens in its own tab rather than anywhere in this page: an
 * uploaded SVG is untrusted markup, and a PDF viewer is not a list item.
 */
export function DesignFile({
  id,
  fileName,
  sizeBytes,
}: {
  id: string;
  fileName: string;
  sizeBytes: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  function onOpen() {
    // Opened on the gesture itself, before anything is awaited. A tab asked for
    // after an await is an unrequested popup as far as Chrome and Safari are
    // concerned, and the button silently does nothing. `noopener` cannot be
    // passed here — it makes the call return null, and the handle is the whole
    // point — so the opener is cleared by hand before the URL lands.
    const tab = window.open("about:blank", "_blank");

    startTransition(async () => {
      const result = await signDesignUrl(id);

      if (!result.ok) {
        tab?.close();
        setBlockedUrl(null);
        setMessage(result.message);
        return;
      }

      setMessage(null);

      if (!tab) {
        // Blocked regardless. Clicking the link is its own gesture, so that
        // navigation is one the browser will honour.
        setBlockedUrl(result.url);
        return;
      }

      setBlockedUrl(null);
      tab.opener = null;
      tab.location.replace(result.url);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {fileName}
        {sizeBytes === null ? null : ` · ${formatFileSize(sizeBytes)}`}
      </span>

      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onOpen}>
        {pending ? "Opening…" : "Open"}
      </Button>

      {blockedUrl ? (
        <a
          href={blockedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Open {fileName}
        </a>
      ) : null}

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
