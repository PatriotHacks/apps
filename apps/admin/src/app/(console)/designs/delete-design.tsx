"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDelete } from "../forms/[id]/edit/controls";
import { deleteDesign } from "./actions";

/**
 * The confirmation names the file, because that is what decides whether this is
 * tidying up a stale link or destroying the only copy of a poster. The action
 * re-checks the role and re-reads the entry, so a click from a page left open
 * cannot delete something that has already gone.
 */
export function DeleteDesign({
  id,
  title,
  fileName,
}: {
  id: string;
  title: string;
  fileName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <ConfirmDelete
        trigger="Delete"
        heading={`Delete ${title}?`}
        confirmLabel="Delete this entry"
        disabled={pending}
        body={
          <p>
            {fileName
              ? `${fileName} is removed from storage with it. Nothing here keeps a copy.`
              : "The entry and its link are removed."}
          </p>
        }
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteDesign(id);
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            setMessage(null);
            router.refresh();
          })
        }
      />

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
