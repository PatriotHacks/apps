"use client";

import { Button, Input, Label, Textarea } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import type { NewsletterBlock, NewsletterBlockType } from "@patriothacks/emails";

import {
  createNewsletter,
  previewNewsletter,
  removeNewsletter,
  saveNewsletter,
  type NewsletterDraft,
  type NewsletterPreview,
} from "./actions";
import { BLOCK_LABELS, BLOCK_TYPES, blankBlock } from "./blocks";

/** One member of the union, so a field editor knows exactly what it is editing. */
type Block<T extends NewsletterBlockType> = Extract<NewsletterBlock, { type: T }>;

type Notice = { tone: "ok" | "bad"; message: string };

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

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
  const [preview, setPreview] = useState<NewsletterPreview | null>(null);
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

  function moveBlock(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= draft.blocks.length) return;

    const next = [...draft.blocks];
    const [block] = next.splice(index, 1);
    next.splice(to, 0, block!);
    setBlocks(next);
  }

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
            Write one into any block and the broadcast fills it at send time. Anything else is
            rejected on save.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {draft.blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks yet.</p>
          ) : null}

          {draft.blocks.map((block, index) => (
            <BlockCard
              // Position is the only identity a block has, and reordering
              // rewrites the whole list, so React remounting a moved card is
              // correct rather than a bug to work around with a generated id.
              key={index}
              block={block}
              index={index}
              count={draft.blocks.length}
              onChange={(next) =>
                setBlocks(draft.blocks.map((current, at) => (at === index ? next : current)))
              }
              onMove={(delta) => moveBlock(index, delta)}
              onRemove={() => setBlocks(draft.blocks.filter((_, at) => at !== index))}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <span className="text-xs text-muted-foreground">Add a block</span>
          {BLOCK_TYPES.map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBlocks([...draft.blocks, blankBlock(type)])}
            >
              {BLOCK_LABELS[type]}
            </Button>
          ))}
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

      <aside className="flex w-full flex-1 flex-col gap-3 lg:max-w-xl">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Preview</h2>
          <span className="text-xs text-muted-foreground">
            {rendering ? "Rendering…" : "Sample values, inside the shared layout"}
          </span>
        </div>

        {preview === null ? (
          <p className="text-sm text-muted-foreground">Rendering…</p>
        ) : preview.status === "invalid" ? (
          <p className="text-sm text-destructive">{preview.message}</p>
        ) : (
          <>
            <iframe
              title="Newsletter preview"
              srcDoc={preview.html}
              className="h-[36rem] w-full rounded border border-border bg-white"
            />
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Text version
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{preview.text}</pre>
            </details>
          </>
        )}
      </aside>
    </div>
  );
}

function BlockCard({
  block,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  block: NewsletterBlock;
  index: number;
  count: number;
  onChange: (next: NewsletterBlock) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const name = `${BLOCK_LABELS[block.type].toLowerCase()} ${index + 1}`;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {index + 1}. {BLOCK_LABELS[block.type]}
        </p>

        <div className="flex items-center">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Move ${name} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Move ${name} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>

      <BlockFields block={block} index={index} onChange={onChange} />
    </div>
  );
}

function BlockFields({
  block,
  index,
  onChange,
}: {
  block: NewsletterBlock;
  index: number;
  onChange: (next: NewsletterBlock) => void;
}) {
  switch (block.type) {
    case "heading":
      return <HeadingFields block={block} index={index} onChange={onChange} />;
    case "text":
      return <TextFields block={block} index={index} onChange={onChange} />;
    case "image":
      return <ImageFields block={block} index={index} onChange={onChange} />;
    case "button":
      return <ButtonFields block={block} index={index} onChange={onChange} />;
    case "divider":
      return <p className="text-xs text-muted-foreground">A horizontal rule. Nothing to set.</p>;
  }
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function HeadingFields({
  block,
  index,
  onChange,
}: {
  block: Block<"heading">;
  index: number;
  onChange: (next: NewsletterBlock) => void;
}) {
  return (
    <>
      <Field id={`block-${index}-text`} label="Text">
        <Input
          id={`block-${index}-text`}
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
        />
      </Field>

      <Field id={`block-${index}-level`} label="Level">
        <select
          id={`block-${index}-level`}
          className={SELECT_CLASS}
          value={block.level}
          onChange={(event) =>
            onChange({ ...block, level: Number(event.target.value) as Block<"heading">["level"] })
          }
        >
          <option value={1}>1 — the issue title</option>
          <option value={2}>2 — a section</option>
          <option value={3}>3 — a sub-heading</option>
        </select>
      </Field>
    </>
  );
}

function TextFields({
  block,
  index,
  onChange,
}: {
  block: Block<"text">;
  index: number;
  onChange: (next: NewsletterBlock) => void;
}) {
  return (
    <>
      <Field id={`block-${index}-text`} label="Paragraph">
        <Textarea
          id={`block-${index}-text`}
          rows={5}
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
        />
      </Field>

      <InsertLink
        onInsert={(markup) =>
          onChange({ ...block, text: block.text.length > 0 ? `${block.text} ${markup}` : markup })
        }
      />
    </>
  );
}

/**
 * Links are a form, not markup: the URL is validated on save and on compile, and
 * an author never has to type an anchor. The result is appended to the paragraph
 * rather than inserted at the caret, so where it lands is predictable.
 */
function InsertLink({ onInsert }: { onInsert: (markup: string) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const ready = label.trim().length > 0 && url.trim().length > 0;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium">Insert link</p>

      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Link text"
          placeholder="The schedule"
          className="min-w-36 flex-1"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <Input
          aria-label="Link address"
          placeholder="https://patriothacks.org/schedule"
          className="min-w-52 flex-1"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ready}
          onClick={() => {
            onInsert(`[${label.trim()}](${url.trim()})`);
            setLabel("");
            setUrl("");
          }}
        >
          Insert
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Added to the end of the paragraph as [text](address). Move it where you want it.
      </p>
    </div>
  );
}

function ImageFields({
  block,
  index,
  onChange,
}: {
  block: Block<"image">;
  index: number;
  onChange: (next: NewsletterBlock) => void;
}) {
  return (
    <>
      <Field id={`block-${index}-url`} label="Image address">
        <Input
          id={`block-${index}-url`}
          placeholder="https://patriothacks.org/newsletter/venue.png"
          value={block.url}
          onChange={(event) => onChange({ ...block, url: event.target.value })}
        />
      </Field>

      <Field id={`block-${index}-alt`} label="Alt text">
        <Input
          id={`block-${index}-alt`}
          value={block.alt}
          onChange={(event) => onChange({ ...block, alt: event.target.value })}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Mail clients block images by default, so the alt text is what most readers see. It is also
        the whole image in the text version.
      </p>

      <Field id={`block-${index}-href`} label="Links to (optional)">
        <Input
          id={`block-${index}-href`}
          placeholder="https://patriothacks.org"
          value={block.href ?? ""}
          onChange={(event) =>
            onChange({
              ...block,
              href: event.target.value.length > 0 ? event.target.value : undefined,
            })
          }
        />
      </Field>
    </>
  );
}

function ButtonFields({
  block,
  index,
  onChange,
}: {
  block: Block<"button">;
  index: number;
  onChange: (next: NewsletterBlock) => void;
}) {
  return (
    <>
      <Field id={`block-${index}-label`} label="Label">
        <Input
          id={`block-${index}-label`}
          placeholder="RSVP now"
          value={block.label}
          onChange={(event) => onChange({ ...block, label: event.target.value })}
        />
      </Field>

      <Field id={`block-${index}-url`} label="Address">
        <Input
          id={`block-${index}-url`}
          placeholder="https://patriothacks.org/rsvp"
          value={block.url}
          onChange={(event) => onChange({ ...block, url: event.target.value })}
        />
      </Field>
    </>
  );
}
