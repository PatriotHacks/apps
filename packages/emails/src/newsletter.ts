import { z } from "zod";

import { escapeHtml } from "./interpolate.ts";

/**
 * A newsletter is a design, not a send: an ordered list of typed blocks that
 * compiles to a body a broadcast can carry. Organizers assemble the blocks;
 * this file owns the markup, so no hand-written HTML reaches an inbox.
 */

/**
 * The one gate between a pasted string and an anchor in someone's inbox. Parsed
 * rather than pattern-matched, so `javascript:`, `data:` and every other scheme
 * fail on what they are rather than on how they were spelled.
 */
export function isSafeUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const urlField = z.string().refine(isSafeUrl, "Must be an http:// or https:// URL");

const headingBlockSchema = z.strictObject({
  type: z.literal("heading"),
  text: z.string().min(1, "A heading needs text"),
  level: z.literal([1, 2, 3]),
});

/** Inline `[label](url)` links are the only markup a paragraph may carry. */
const textBlockSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1, "A paragraph needs text"),
});

const imageBlockSchema = z.strictObject({
  type: z.literal("image"),
  url: urlField,
  // Required: mail clients block images by default, so the alt text is what
  // most readers actually see, and it is the whole image in the text body.
  alt: z.string().min(1, "An image needs alt text"),
  href: urlField.optional(),
});

const buttonBlockSchema = z.strictObject({
  type: z.literal("button"),
  label: z.string().min(1, "A button needs a label"),
  url: urlField,
});

const dividerBlockSchema = z.strictObject({ type: z.literal("divider") });

export const newsletterBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
]);

export const newsletterBlocksSchema = z.array(newsletterBlockSchema);

export type NewsletterBlock = z.infer<typeof newsletterBlockSchema>;
export type NewsletterBlockType = NewsletterBlock["type"];

export type NewsletterParseResult =
  | { ok: true; blocks: NewsletterBlock[] }
  | { ok: false; message: string };

/**
 * The schema behind a readable message, so callers report what is wrong with a
 * block without importing zod or surfacing an issue dump. Every read of a
 * stored row goes through here too: a row edited by hand fails at the loader
 * rather than reaching the builder as garbage.
 */
export function parseNewsletterBlocks(input: unknown): NewsletterParseResult {
  const result = newsletterBlocksSchema.safeParse(input);
  if (result.success) return { ok: true, blocks: result.data };

  const problems = result.error.issues.map((issue) => {
    const [index, field] = issue.path;
    if (typeof index !== "number") return issue.message;
    const where = typeof field === "string" ? `Block ${index + 1} ${field}` : `Block ${index + 1}`;
    return `${where}: ${issue.message}`;
  });

  return { ok: false, message: [...new Set(problems)].join(". ") };
}

export type CompiledNewsletter = { html: string; text: string };

/** `[label](url)`. The label may not nest brackets and the URL may not contain
    whitespace or parentheses, which keeps the syntax unambiguous without a
    parser. */
const LINK = /\[([^[\]]*)\]\(([^\s()]+)\)/g;

const BODY_COLOR = "#1f2933";
const BRAND_COLOR = "#0a2240";
const RULE_COLOR = "#e5e5e5";

const HEADING_SIZE: Record<1 | 2 | 3, string> = { 1: "24px", 2: "20px", 3: "17px" };

/** A one-cell layout table: the only block container mail clients all agree on. */
const layoutCell = (content: string) =>
  `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px"><tr><td>${content}</td></tr></table>`;

/**
 * Escapes the author's text and turns `[label](url)` into an anchor. A link
 * whose URL the validator rejects, and a `[` that never completes a link, are
 * left as the literal characters typed — a typo stays visible rather than
 * silently disappearing or becoming a live link to somewhere unexpected.
 *
 * `escapeHtml` touches only `& < > " '`, so a `{{variable}}` written into a
 * block passes through untouched and `interpolate` can still fill it at send
 * time, over the compiled HTML.
 */
function inlineHtml(text: string): string {
  let html = "";
  let cursor = 0;

  for (const match of text.matchAll(LINK)) {
    const literal = match[0]!;
    const label = match[1]!;
    const url = match[2]!;

    html += escapeHtml(text.slice(cursor, match.index));
    html += isSafeUrl(url)
      ? `<a href="${escapeHtml(url)}" style="color:${BRAND_COLOR};text-decoration:underline">${escapeHtml(label)}</a>`
      : escapeHtml(literal);
    cursor = match.index + literal.length;
  }

  html += escapeHtml(text.slice(cursor));
  return html.replace(/\n/g, "<br />");
}

function blockHtml(block: NewsletterBlock): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level} style="color:${BRAND_COLOR};font-size:${HEADING_SIZE[block.level]};font-weight:700;line-height:1.3;margin:0 0 12px">${escapeHtml(block.text)}</h${block.level}>`;

    case "text":
      return `<p style="color:${BODY_COLOR};font-size:15px;line-height:24px;margin:0 0 16px">${inlineHtml(block.text)}</p>`;

    case "image": {
      const image = `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt)}" style="border:0;display:block;height:auto;max-width:100%" />`;
      return layoutCell(block.href ? `<a href="${escapeHtml(block.href)}">${image}</a>` : image);
    }

    // A padded anchor on a coloured cell, not a `<button>`: form controls do not
    // render in mail, and a background on the cell survives clients that drop
    // the one on the anchor.
    case "button":
      return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px"><tr><td align="center" style="background-color:${BRAND_COLOR};border-radius:6px"><a href="${escapeHtml(block.url)}" style="color:#ffffff;display:inline-block;font-size:15px;font-weight:600;padding:12px 20px;text-decoration:none">${escapeHtml(block.label)}</a></td></tr></table>`;

    case "divider":
      return `<hr style="border:none;border-top:1px solid ${RULE_COLOR};margin:24px 0" />`;
  }
}

const TEXT_RULE = "----------------------------------------";

function inlineText(text: string): string {
  return text.replace(LINK, (literal, label: string, url: string) =>
    isSafeUrl(url) ? `${label} (${url})` : literal,
  );
}

function blockText(block: NewsletterBlock): string {
  switch (block.type) {
    case "heading":
      return block.text;
    case "text":
      return inlineText(block.text);
    case "image":
      return block.alt;
    case "button":
      return `${block.label} (${block.url})`;
    case "divider":
      return TEXT_RULE;
  }
}

/**
 * Body-level output only. `html` carries no doctype and no wrapper — it is a
 * broadcast's `bodyHtml`, which `renderTemplate` pours through `renderLayout`
 * — and `text` is its `bodyText`, which `wrapText` gives the footer.
 */
export function compileNewsletter(blocks: NewsletterBlock[]): CompiledNewsletter {
  return {
    html: blocks.map(blockHtml).join("\n"),
    text: blocks.map(blockText).join("\n\n"),
  };
}
