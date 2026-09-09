"use client";

import { Button, Input, Label, Textarea } from "@patriothacks/ui";
import { useState } from "react";

import {
  saveTemplate,
  sendTestEmail,
  type TemplateDraft,
} from "../actions";

type Notice = { tone: "ok" | "bad"; message: string };

export function TemplateEditor({
  templateKey,
  variables,
  testAddress,
  initial,
}: {
  templateKey: string;
  variables: string[];
  testAddress: string | null;
  initial: TemplateDraft;
}) {
  const [draft, setDraft] = useState<TemplateDraft>(initial);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const field = <K extends keyof TemplateDraft>(name: K) => ({
    value: draft[name],
    onChange: (event: { target: { value: string } }) => {
      setDraft((current) => ({ ...current, [name]: event.target.value }));
      setNotice(null);
    },
  });

  async function onSave() {
    setBusy("save");
    const result = await saveTemplate(templateKey, draft);
    setBusy(null);
    setNotice(
      result.status === "saved"
        ? { tone: "ok", message: "Saved." }
        : { tone: "bad", message: result.message },
    );
  }

  async function onTest() {
    setBusy("test");
    const result = await sendTestEmail(templateKey);
    setBusy(null);
    setNotice(
      result.status === "sent"
        ? { tone: "ok", message: `Test sent to ${result.to}.` }
        : { tone: "bad", message: result.message },
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
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
          Anything else is rejected on save. Values are escaped in the HTML body, so an applicant
          cannot inject markup.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" {...field("subject")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bodyHtml">HTML body</Label>
        <Textarea id="bodyHtml" rows={8} className="font-mono text-base md:text-xs" {...field("bodyHtml")} />
        <p className="text-xs text-muted-foreground">
          Goes inside the shared layout — no doctype, header or footer needed.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bodyText">Text body</Label>
        <Textarea id="bodyText" rows={6} className="font-mono text-base md:text-xs" {...field("bodyText")} />
      </div>

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
          {busy === "save" ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={onTest} disabled={busy !== null || testAddress === null}>
          {busy === "test" ? "Sending…" : "Send test to me"}
        </Button>
        {testAddress ? (
          <span className="text-xs text-muted-foreground">
            Sends the saved template to {testAddress} with sample values.
          </span>
        ) : null}
      </div>
    </div>
  );
}
