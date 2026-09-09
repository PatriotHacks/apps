import { newsletters } from "@patriothacks/database";
import { parseNewsletterBlocks, type NewsletterBlock } from "@patriothacks/emails";
import { desc, eq } from "drizzle-orm";

import { queryAsAdmin } from "@/lib/db";
import { isUuid } from "@/lib/form-definition";

export type NewsletterListRow = {
  id: string;
  name: string;
  blockCount: number;
  updatedAt: Date;
};

export type NewsletterDetail = {
  id: string;
  name: string;
  blocks: NewsletterBlock[];
  updatedAt: Date;
};

/**
 * Every read parses `blocks` through the schema. The builder is the only writer,
 * so a row that fails here was edited by hand — and failing loudly beats handing
 * the builder a block it cannot render or a URL nothing validated.
 */
function blocksOf(name: string, value: unknown): NewsletterBlock[] {
  const parsed = parseNewsletterBlocks(value);
  if (!parsed.ok) throw new Error(`Newsletter "${name}" has unreadable blocks. ${parsed.message}`);
  return parsed.blocks;
}

export async function listNewsletters(): Promise<NewsletterListRow[]> {
  const rows = await queryAsAdmin((tx) =>
    tx
      .select({
        id: newsletters.id,
        name: newsletters.name,
        blocks: newsletters.blocks,
        updatedAt: newsletters.updatedAt,
      })
      .from(newsletters)
      .orderBy(desc(newsletters.updatedAt)),
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    blockCount: blocksOf(row.name, row.blocks).length,
    updatedAt: row.updatedAt,
  }));
}

export async function getNewsletter(id: string): Promise<NewsletterDetail | null> {
  if (!isUuid(id)) return null;

  const [row] = await queryAsAdmin((tx) =>
    tx
      .select({
        id: newsletters.id,
        name: newsletters.name,
        blocks: newsletters.blocks,
        updatedAt: newsletters.updatedAt,
      })
      .from(newsletters)
      .where(eq(newsletters.id, id))
      .limit(1),
  );

  if (!row) return null;
  return { id: row.id, name: row.name, blocks: blocksOf(row.name, row.blocks), updatedAt: row.updatedAt };
}

/** The picker in the broadcast composer. Blocks are compiled on load, not here. */
export function listNewsletterChoices(): Promise<{ id: string; name: string }[]> {
  return queryAsAdmin((tx) =>
    tx
      .select({ id: newsletters.id, name: newsletters.name })
      .from(newsletters)
      .orderBy(desc(newsletters.updatedAt)),
  );
}

export async function insertNewsletter(
  name: string,
  blocks: NewsletterBlock[],
  actorId: string,
): Promise<string | undefined> {
  const [row] = await queryAsAdmin((tx) =>
    tx
      .insert(newsletters)
      .values({ name, blocks, createdBy: actorId, updatedBy: actorId })
      .returning({ id: newsletters.id }),
  );

  return row?.id;
}

/** `false` when the row is gone — an editor left open after a delete elsewhere. */
export async function updateNewsletter(
  id: string,
  name: string,
  blocks: NewsletterBlock[],
  actorId: string,
): Promise<boolean> {
  if (!isUuid(id)) return false;

  const rows = await queryAsAdmin((tx) =>
    tx
      .update(newsletters)
      .set({ name, blocks, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(newsletters.id, id))
      .returning({ id: newsletters.id }),
  );

  return rows.length > 0;
}

export async function deleteNewsletter(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;

  const rows = await queryAsAdmin((tx) =>
    tx.delete(newsletters).where(eq(newsletters.id, id)).returning({ id: newsletters.id }),
  );

  return rows.length > 0;
}
