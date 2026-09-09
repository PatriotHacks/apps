import { emailTemplates } from "@patriothacks/database";
import {
  isCustomTemplateKey,
  isTemplateKey,
  parseNewsletterBlocks,
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  type CustomTemplateKey,
  type NewsletterBlock,
  type TemplateKey,
} from "@patriothacks/emails";
import { asc, eq } from "drizzle-orm";

import { queryAsAdmin, queryAsStaff } from "@/lib/db";

/**
 * A row is built in when the code catalogue declares its key and an admin's own
 * otherwise. The database cannot read that catalogue — it enforces only that a
 * custom row carries both a label and blocks — so the split is decided here,
 * once, and callers read `kind` rather than deriving it again.
 */
export type BuiltInTemplate = {
  kind: "builtin";
  key: TemplateKey;
  label: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  updatedAt: Date;
};

export type CustomTemplate = {
  kind: "custom";
  key: CustomTemplateKey;
  label: string;
  subject: string;
  blocks: NewsletterBlock[];
  updatedAt: Date;
};

export type StoredTemplateRow = BuiltInTemplate | CustomTemplate;

/** What a custom template's editor writes. The key is not here: it is minted at
    creation and never follows a rename, because `email_sends` records it. */
export type CustomTemplateWrite = {
  name: string;
  subject: string;
  blocks: NewsletterBlock[];
  bodyHtml: string;
  bodyText: string;
};

const COLUMNS = {
  key: emailTemplates.key,
  name: emailTemplates.name,
  subject: emailTemplates.subject,
  bodyHtml: emailTemplates.bodyHtml,
  bodyText: emailTemplates.bodyText,
  blocks: emailTemplates.blocks,
  updatedAt: emailTemplates.updatedAt,
};

type Row = {
  key: string;
  name: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  blocks: unknown;
  updatedAt: Date;
};

/**
 * `blocks` is parsed on every read, the way the newsletter loader parses its own:
 * the builder is the only writer, so a row that fails here was edited by hand,
 * and failing loudly beats handing the builder a block it cannot render.
 *
 * `null` for a row that is neither — a key nothing declares and nothing minted.
 * It has no send site, no variables and no label, so there is nothing to show.
 */
function toTemplate(row: Row): StoredTemplateRow | null {
  if (isTemplateKey(row.key)) {
    return {
      kind: "builtin",
      key: row.key,
      label: TEMPLATE_LABELS[row.key],
      subject: row.subject,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      updatedAt: row.updatedAt,
    };
  }

  if (!isCustomTemplateKey(row.key) || row.name === null) return null;

  const parsed = parseNewsletterBlocks(row.blocks);
  if (!parsed.ok) {
    throw new Error(`Template "${row.name}" has unreadable blocks. ${parsed.message}`);
  }

  return {
    kind: "custom",
    key: row.key,
    label: row.name,
    subject: row.subject,
    blocks: parsed.blocks,
    updatedAt: row.updatedAt,
  };
}

/**
 * Built-ins first in catalogue order — accepted / waitlisted / rejected reads as
 * the decision pipeline, which is how an organizer thinks about these — then the
 * admin's own in the order they were created.
 */
export async function listTemplates(): Promise<StoredTemplateRow[]> {
  const rows = await queryAsStaff((tx) =>
    tx.select(COLUMNS).from(emailTemplates).orderBy(asc(emailTemplates.createdAt)),
  );

  const templates = rows
    .map(toTemplate)
    .filter((template): template is StoredTemplateRow => template !== null);

  const builtIn = templates
    .filter((template): template is BuiltInTemplate => template.kind === "builtin")
    .sort((a, b) => TEMPLATE_KEYS.indexOf(a.key) - TEMPLATE_KEYS.indexOf(b.key));

  return [...builtIn, ...templates.filter((template) => template.kind === "custom")];
}

export async function getTemplate(key: string): Promise<StoredTemplateRow | null> {
  if (!isTemplateKey(key) && !isCustomTemplateKey(key)) return null;

  const [row] = await queryAsStaff((tx) =>
    tx.select(COLUMNS).from(emailTemplates).where(eq(emailTemplates.key, key)).limit(1),
  );

  return row ? toTemplate(row) : null;
}

/**
 * The picker in the broadcast composer. Built-ins are never offered: they
 * reference `form_title` and `rsvp_url`, which no broadcast can fill.
 */
export async function listCustomTemplateChoices(): Promise<{ key: string; name: string }[]> {
  const rows = await queryAsAdmin((tx) =>
    tx
      .select({ key: emailTemplates.key, name: emailTemplates.name })
      .from(emailTemplates)
      .orderBy(asc(emailTemplates.createdAt)),
  );

  return rows.flatMap((row) =>
    isCustomTemplateKey(row.key) && row.name !== null ? [{ key: row.key, name: row.name }] : [],
  );
}

/**
 * `undefined` when the key is taken. The unique constraint decides rather than a
 * prior read, so two admins naming a template the same thing cannot both win.
 */
export async function insertCustomTemplate(
  key: CustomTemplateKey,
  write: CustomTemplateWrite,
  actorId: string,
): Promise<CustomTemplateKey | undefined> {
  const rows = await queryAsAdmin((tx) =>
    tx
      .insert(emailTemplates)
      .values({ key, ...write, updatedBy: actorId })
      .onConflictDoNothing({ target: emailTemplates.key })
      .returning({ key: emailTemplates.key }),
  );

  return rows.length > 0 ? key : undefined;
}

/** `false` when the row is gone — an editor left open after a delete elsewhere. */
export async function updateCustomTemplate(
  key: string,
  write: CustomTemplateWrite,
  actorId: string,
): Promise<boolean> {
  if (!isCustomTemplateKey(key)) return false;

  const rows = await queryAsAdmin((tx) =>
    tx
      .update(emailTemplates)
      .set({ ...write, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(emailTemplates.key, key))
      .returning({ key: emailTemplates.key }),
  );

  return rows.length > 0;
}

/** Custom keys only. A built-in has a send site in code and cannot be deleted. */
export async function deleteCustomTemplate(key: string): Promise<boolean> {
  if (!isCustomTemplateKey(key)) return false;

  const rows = await queryAsAdmin((tx) =>
    tx
      .delete(emailTemplates)
      .where(eq(emailTemplates.key, key))
      .returning({ key: emailTemplates.key }),
  );

  return rows.length > 0;
}
