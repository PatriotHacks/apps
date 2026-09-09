"use server";

import {
  BROADCAST_KEY,
  compileNewsletter,
  parseNewsletterBlocks,
  renderTemplate,
  sampleContext,
  unknownVariables,
  variablesFor,
  type NewsletterBlock,
} from "@patriothacks/emails";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { deleteNewsletter, insertNewsletter, updateNewsletter } from "@/lib/newsletters";

export type NewsletterDraft = {
  name: string;
  blocks: NewsletterBlock[];
};

export type SaveNewsletterResult =
  | { status: "created"; id: string }
  | { status: "saved" }
  | { status: "invalid"; message: string };

export type DeleteNewsletterResult =
  | { status: "deleted" }
  | { status: "invalid"; message: string };

export type NewsletterPreview =
  | { status: "ok"; html: string; text: string }
  | { status: "invalid"; message: string };

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

type Checked =
  | { ok: true; blocks: NewsletterBlock[]; html: string; text: string }
  | { ok: false; message: string };

/**
 * The single gate for every action here. The blocks arrive from the browser, so
 * they are parsed rather than trusted — that parse is what keeps a `javascript:`
 * URL out of an anchor — and the compiled output is checked for placeholders a
 * broadcast cannot fill, which is the same save-time gate the composer applies.
 */
function check(draft: NewsletterDraft): Checked {
  if (!draft.name.trim()) return { ok: false, message: "Give the newsletter a name." };

  const parsed = parseNewsletterBlocks(draft.blocks);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  if (parsed.blocks.length === 0) return { ok: false, message: "Add at least one block." };

  const { html, text } = compileNewsletter(parsed.blocks);
  const unknown = unknownVariables(BROADCAST_KEY, html, text);

  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unknown ${unknown.length === 1 ? "variable" : "variables"} ${unknown
        .map((name) => `{{${name}}}`)
        .join(", ")}. A newsletter only has ${variablesFor(BROADCAST_KEY)
        .map((name) => `{{${name}}}`)
        .join(", ")}.`,
    };
  }

  return { ok: true, blocks: parsed.blocks, html, text };
}

/**
 * The builder's live preview: compiled, filled from the sample context and
 * poured through the layout shell, so what the iframe shows is what a recipient
 * would read. Every failure comes back as a sentence rather than as a stack.
 */
export async function previewNewsletter(draft: NewsletterDraft): Promise<NewsletterPreview> {
  await requireAdmin();

  const checked = check(draft);
  if (!checked.ok) return { status: "invalid", message: checked.message };

  const context = sampleContext(BROADCAST_KEY);

  try {
    const email = await renderTemplate(
      { key: BROADCAST_KEY, subject: draft.name, bodyHtml: checked.html, bodyText: checked.text },
      context,
      context.unsubscribe_url,
    );

    return { status: "ok", html: email.html, text: email.text };
  } catch (cause) {
    return { status: "invalid", message: reason(cause) };
  }
}

export async function createNewsletter(draft: NewsletterDraft): Promise<SaveNewsletterResult> {
  const staff = await requireAdmin();

  const checked = check(draft);
  if (!checked.ok) return { status: "invalid", message: checked.message };

  const id = await insertNewsletter(draft.name.trim(), checked.blocks, staff.userId);
  if (!id) return { status: "invalid", message: "The newsletter could not be saved." };

  revalidatePath("/newsletters");
  return { status: "created", id };
}

export async function saveNewsletter(
  id: string,
  draft: NewsletterDraft,
): Promise<SaveNewsletterResult> {
  const staff = await requireAdmin();

  const checked = check(draft);
  if (!checked.ok) return { status: "invalid", message: checked.message };

  const found = await updateNewsletter(id, draft.name.trim(), checked.blocks, staff.userId);
  if (!found) return { status: "invalid", message: "That newsletter no longer exists." };

  revalidatePath("/newsletters");
  revalidatePath(`/newsletters/${id}`);
  return { status: "saved" };
}

/**
 * Deleting a design leaves every broadcast that loaded it untouched: the
 * compiled body was copied onto the broadcast row, so nothing already sent or
 * queued depends on this table.
 */
export async function removeNewsletter(id: string): Promise<DeleteNewsletterResult> {
  await requireAdmin();

  const found = await deleteNewsletter(id);
  if (!found) return { status: "invalid", message: "That newsletter no longer exists." };

  revalidatePath("/newsletters");
  return { status: "deleted" };
}
