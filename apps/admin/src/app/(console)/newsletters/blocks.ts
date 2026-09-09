import type { NewsletterBlock, NewsletterBlockType } from "@patriothacks/emails";

/**
 * Authoring defaults and labels for the block picker.
 *
 * Deliberately here rather than in `@patriothacks/emails`: the builder is a
 * client component, and importing that package at runtime would drag the `pg`
 * driver behind it into the browser bundle. Only the types cross over, and types
 * are erased.
 *
 * Keying both records by the block type is what keeps this file honest — a new
 * block in the schema fails to compile until it has a blank and a label.
 */
const BLANK: Record<NewsletterBlockType, () => NewsletterBlock> = {
  heading: () => ({ type: "heading", text: "", level: 2 }),
  text: () => ({ type: "text", text: "" }),
  image: () => ({ type: "image", url: "", alt: "" }),
  button: () => ({ type: "button", label: "", url: "" }),
  divider: () => ({ type: "divider" }),
};

export const BLOCK_LABELS: Record<NewsletterBlockType, string> = {
  heading: "Heading",
  text: "Paragraph",
  image: "Image",
  button: "Button",
  divider: "Divider",
};

/** Picker order: the two blocks most issues are made of, then the rest. */
export const BLOCK_TYPES = [
  "heading",
  "text",
  "image",
  "button",
  "divider",
] as const satisfies readonly NewsletterBlockType[];

export const blankBlock = (type: NewsletterBlockType): NewsletterBlock => BLANK[type]();

/** What a new newsletter opens on, empty and waiting rather than pre-worded. */
export const starterBlocks = (): NewsletterBlock[] => [blankBlock("heading"), blankBlock("text")];
