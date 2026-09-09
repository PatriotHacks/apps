"use client";

import { Button, Checkbox, Input, Label, Select, Textarea } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  AUDIENCE_RSVP_STATUSES,
  AUDIENCE_STATUSES,
  EMPTY_FILTER,
  RSVP_LABELS,
  STATUS_LABELS,
  type AudienceCount,
  type AudienceFilter,
  type AudienceRsvpStatus,
  type AudienceStatus,
} from "@/lib/broadcast-audience";

import {
  createBroadcast,
  loadNewsletterBody,
  previewAudience,
  previewBroadcast,
  type BroadcastDraft,
  type PreviewResult,
} from "../actions";

const EMPTY_DRAFT: BroadcastDraft = { name: "", subject: "", bodyHtml: "", bodyText: "" };

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

export function BroadcastComposer({
  forms,
  newsletters,
  variables,
}: {
  forms: { id: string; title: string }[];
  newsletters: { id: string; name: string }[];
  /** Passed from the server so the emails package — and the `pg` driver behind
      it — never reaches the browser bundle. */
  variables: readonly string[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<BroadcastDraft>(EMPTY_DRAFT);
  const [filter, setFilter] = useState<AudienceFilter>(EMPTY_FILTER);
  const [count, setCount] = useState<AudienceCount | null>(null);
  const [counting, startCounting] = useTransition();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [newsletterId, setNewsletterId] = useState("");
  const [busy, setBusy] = useState<"preview" | "save" | "newsletter" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recounted whenever the filter moves, so the number on screen is always the
  // number this filter means rather than the number the last one meant.
  useEffect(() => {
    let current = true;
    startCounting(async () => {
      const result = await previewAudience(filter);
      if (current) setCount(result);
    });
    return () => {
      current = false;
    };
  }, [filter]);

  const field = <K extends keyof BroadcastDraft>(name: K) => ({
    value: draft[name],
    onChange: (event: { target: { value: string } }) => {
      setDraft((current) => ({ ...current, [name]: event.target.value }));
      setError(null);
    },
  });

  /**
   * Compiled on the server and copied in, so the broadcast owns its body from
   * here on. Overwriting is confirmed rather than prevented — loading a
   * newsletter over a half-written body is a normal thing to want, and losing it
   * silently is not.
   */
  async function onLoadNewsletter() {
    const written = draft.bodyHtml.trim().length > 0 || draft.bodyText.trim().length > 0;
    if (written && !window.confirm("Replace the HTML and text bodies with this newsletter?")) return;

    setBusy("newsletter");
    const result = await loadNewsletterBody(newsletterId);
    setBusy(null);

    if (result.status === "invalid") {
      setError(result.message);
      return;
    }

    setDraft((current) => ({ ...current, bodyHtml: result.bodyHtml, bodyText: result.bodyText }));
    setError(null);
  }

  async function onPreview() {
    setBusy("preview");
    setPreview(await previewBroadcast(draft, filter));
    setBusy(null);
  }

  async function onSave() {
    setBusy("save");
    const result = await createBroadcast(draft, filter);
    setBusy(null);
    if (result.status === "created") router.push(`/emails/broadcasts/${result.id}`);
    else setError(result.message);
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex max-w-2xl flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Check-in details" {...field("name")} />
          <p className="text-xs text-muted-foreground">Internal only — recipients never see it.</p>
        </div>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium">Available variables</p>
          <p className="mt-2 flex flex-wrap gap-2">
            {variables.map((name) => (
              <code key={name} className="rounded bg-background px-1.5 py-0.5 text-xs">
                {`{{${name}}}`}
              </code>
            ))}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            An unsubscribe link is added to every broadcast whether or not the body uses one.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" {...field("subject")} />
        </div>

        {newsletters.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="newsletterId">Newsletter</Label>
            <div className="flex flex-wrap gap-2">
              <Select
                id="newsletterId"
                className="min-w-52 flex-1"
                value={newsletterId}
                onChange={(event) => setNewsletterId(event.target.value)}
              >
                <option value="">Write the body by hand</option>
                {newsletters.map((newsletter) => (
                  <option key={newsletter.id} value={newsletter.id}>
                    {newsletter.name}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                onClick={onLoadNewsletter}
                disabled={busy !== null || newsletterId === ""}
              >
                {busy === "newsletter" ? "Loading…" : "Load"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Fills both bodies with the compiled newsletter. Edit them here afterwards if you like
              — the newsletter itself is untouched.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="bodyHtml">HTML body</Label>
          <Textarea id="bodyHtml" rows={8} className="font-mono text-base md:text-xs" {...field("bodyHtml")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="bodyText">Text body</Label>
          <Textarea id="bodyText" rows={6} className="font-mono text-base md:text-xs" {...field("bodyText")} />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onSave} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </Button>
          <Button variant="outline" onClick={onPreview} disabled={busy !== null}>
            {busy === "preview" ? "Rendering…" : "Preview"}
          </Button>
        </div>

        {preview ? <Preview result={preview} /> : null}
      </div>

      <aside className="order-first flex w-full max-w-sm flex-col gap-5 lg:order-none">
        <div>
          <h2 className="text-sm font-semibold">Audience</h2>
          <p className="text-xs text-muted-foreground">
            Drafts are never included — a draft is not an application.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="formId">Form</Label>
          <Select
            id="formId"
            value={filter.formId ?? ""}
            onChange={(event) =>
              setFilter((current) => ({ ...current, formId: event.target.value || null }))
            }
          >
            <option value="">Any form</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.title}
              </option>
            ))}
          </Select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Status</legend>
          <p className="text-xs text-muted-foreground">None checked means any status.</p>
          {AUDIENCE_STATUSES.map((status) => (
            <CheckRow
              key={status}
              id={`status-${status}`}
              label={STATUS_LABELS[status]}
              checked={filter.statuses.includes(status)}
              onToggle={() =>
                setFilter((current) => ({
                  ...current,
                  statuses: toggle<AudienceStatus>(current.statuses, status),
                }))
              }
            />
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">RSVP</legend>
          <p className="text-xs text-muted-foreground">None checked means any RSVP state.</p>
          {AUDIENCE_RSVP_STATUSES.map((rsvp) => (
            <CheckRow
              key={rsvp}
              id={`rsvp-${rsvp}`}
              label={RSVP_LABELS[rsvp]}
              checked={filter.rsvpStatuses.includes(rsvp)}
              onToggle={() =>
                setFilter((current) => ({
                  ...current,
                  rsvpStatuses: toggle<AudienceRsvpStatus>(current.rsvpStatuses, rsvp),
                }))
              }
            />
          ))}
        </fieldset>

        <AudienceSummary count={count} counting={counting} />
      </aside>
    </div>
  );
}

function CheckRow({
  id,
  label,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}

/**
 * The excluded number is stated as plainly as the included one. Someone about
 * to mail 800 people should read "41 excluded by unsubscribe" here, not work it
 * out from `email_sends` afterwards.
 */
function AudienceSummary({ count, counting }: { count: AudienceCount | null; counting: boolean }) {
  return (
    <div className="rounded-md border border-border p-3" data-testid="audience-summary">
      {count === null ? (
        <p className="text-sm text-muted-foreground">Counting…</p>
      ) : (
        <>
          <p className="text-2xl font-semibold" data-testid="recipient-count">
            {count.recipients}
          </p>
          <p className="text-sm text-muted-foreground">
            {count.recipients === 1 ? "recipient" : "recipients"}
            {counting ? " · updating…" : null}
          </p>
          <p className="mt-2 text-sm" data-testid="unsubscribed-count">
            {count.unsubscribed === 0 ? (
              <span className="text-muted-foreground">Nobody in this audience has unsubscribed.</span>
            ) : (
              <span>
                <strong>{count.unsubscribed}</strong> of {count.matched} matched{" "}
                {count.matched === 1 ? "person has" : "people have"} unsubscribed and will not be
                mailed.
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );
}

function Preview({ result }: { result: PreviewResult }) {
  if (result.status === "invalid") {
    return <p className="text-sm text-destructive">{result.message}</p>;
  }

  if (result.status === "empty") {
    return (
      <p className="text-sm text-muted-foreground">
        No recipient matches this audience, so there is nobody to preview against.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <p className="text-xs text-muted-foreground">
        Rendered for <strong>{result.to}</strong>
      </p>
      <p className="text-sm font-medium">{result.subject}</p>
      <iframe
        title="Broadcast preview"
        srcDoc={result.html}
        className="h-96 w-full rounded border border-border bg-white"
      />
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">Text version</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{result.text}</pre>
      </details>
    </div>
  );
}
