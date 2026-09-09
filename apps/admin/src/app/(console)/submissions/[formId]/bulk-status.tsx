"use client";

import { Button, Select } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { submissionStatusLabel } from "@/components/submission-status-badge";
import { SETTABLE_STATUSES, type SettableStatus } from "@/lib/decisions";

import { setStatusForFilter } from "./actions";

/**
 * Bulk decisions over the current filter.
 *
 * Deliberately not a per-row checkbox column: the filter can select 800 rows
 * across 16 pages, and a selection that only covers the page you can see is a
 * different set from the one the header claims. What goes to the server is the
 * query string, so "the filtered set" means the same thing on both sides.
 *
 * Two clicks, because this is the one control in the console that can rewrite
 * hundreds of rows and there is no undo.
 */
export function BulkStatus({
  formId,
  search,
  total,
}: {
  formId: string;
  search: string;
  total: number;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<SettableStatus>("under_review");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onApply() {
    setBusy(true);
    const result = await setStatusForFilter(formId, search, target);
    setBusy(false);
    setArmed(false);
    if (result.status === "error") {
      setNotice(result.message);
      return;
    }
    setNotice(
      `${result.changed} set to ${submissionStatusLabel(target)}` +
        (result.skipped > 0 ? `, ${result.skipped} left alone (draft or withdrawn).` : "."),
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <span className="text-sm font-medium">Bulk status</span>

      <Select
        value={target}
        onChange={(event) => {
          setTarget(event.target.value as SettableStatus);
          setArmed(false);
          setNotice(null);
        }}
        className="sm:w-auto"
        aria-label="Status to apply"
      >
        {SETTABLE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {submissionStatusLabel(status)}
          </option>
        ))}
      </Select>

      {armed ? (
        <>
          <Button
            size="sm"
            variant="destructive"
            className="h-auto w-full py-2 text-left whitespace-normal sm:w-auto sm:text-center"
            disabled={busy}
            onClick={onApply}
          >
            {busy
              ? "Applying…"
              : `Confirm: ${submissionStatusLabel(target)} for ${total} matching`}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setArmed(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" disabled={total === 0} onClick={() => setArmed(true)}>
          Apply to all {total} matching
        </Button>
      )}

      {notice ? <span className="text-sm text-muted-foreground">{notice}</span> : null}
    </div>
  );
}
