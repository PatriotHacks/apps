"use client";

import { Button, Input, Label, Select, Textarea } from "@patriothacks/ui";
import { useState, type ReactNode } from "react";

import type { NewsletterBlock, NewsletterBlockType } from "@patriothacks/emails";

import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  blankBlock,
  type BlockPreviewResult,
} from "@/lib/blocks";

/**
 * The block builder's editing surface, shared by the newsletter designer and the
 * custom email template editor. Both build the same block array and compile it
 * through the same compiler, so they edit it with the same controls; only what
 * surrounds them — the name, the subject, which action saves — differs.
 */

/** One member of the union, so a field editor knows exactly what it is editing. */
type Block<T extends NewsletterBlockType> = Extract<NewsletterBlock, { type: T }>;

/** The variables the surrounding body may reference, listed rather than guessed at. */
export function VariablesPanel({
  variables,
  note,
}: {
  variables: readonly string[];
  note: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium">Available variables</p>
      <p className="mt-2 flex flex-wrap gap-2">
        {variables.map((name) => (
          <code key={name} className="rounded bg-background px-1.5 py-0.5 text-xs">
            {`{{${name}}}`}
          </code>
        ))}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

/** The ordered block list and the picker that appends to it. */
export function BlockList({
  blocks,
  onChange,
}: {
  blocks: NewsletterBlock[];
  onChange: (next: NewsletterBlock[]) => void;
}) {
  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= blocks.length) return;

    const next = [...blocks];
    const [block] = next.splice(index, 1);
    next.splice(to, 0, block!);
    onChange(next);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blocks yet.</p>
        ) : null}

        {blocks.map((block, index) => (
          <BlockCard
            // Position is the only identity a block has, and reordering
            // rewrites the whole list, so React remounting a moved card is
            // correct rather than a bug to work around with a generated id.
            key={index}
            block={block}
            index={index}
            count={blocks.length}
            onChange={(next) =>
              onChange(blocks.map((current, at) => (at === index ? next : current)))
            }
            onMove={(delta) => move(index, delta)}
            onRemove={() => onChange(blocks.filter((_, at) => at !== index))}
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
            onClick={() => onChange([...blocks, blankBlock(type)])}
          >
            {BLOCK_LABELS[type]}
          </Button>
        ))}
      </div>
    </>
  );
}

/**
 * The compiled result beside the blocks that made it. Rendered by the server, so
 * the iframe shows what a recipient would read rather than an approximation of
 * it.
 */
export function BlockPreview({
  result,
  rendering,
  title,
}: {
  result: BlockPreviewResult | null;
  rendering: boolean;
  title: string;
}) {
  return (
    <aside className="flex w-full flex-1 flex-col gap-3 lg:max-w-xl">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Preview</h2>
        <span className="text-xs text-muted-foreground">
          {rendering ? "Rendering…" : "Sample values, inside the shared layout"}
        </span>
      </div>

      {result === null ? (
        <p className="text-sm text-muted-foreground">Rendering…</p>
      ) : result.status === "invalid" ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : (
        <>
          <iframe
            title={title}
            srcDoc={result.html}
            className="h-[36rem] w-full rounded border border-border bg-white"
          />
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">Text version</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{result.text}</pre>
          </details>
        </>
      )}
    </aside>
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
        <Select
          id={`block-${index}-level`}
          value={block.level}
          onChange={(event) =>
            onChange({ ...block, level: Number(event.target.value) as Block<"heading">["level"] })
          }
        >
          <option value={1}>1 — the issue title</option>
          <option value={2}>2 — a section</option>
          <option value={3}>3 — a sub-heading</option>
        </Select>
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
