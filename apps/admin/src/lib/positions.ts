import {
  formSections,
  questionOptions,
  questions,
  type DatabaseTransaction,
} from "@patriothacks/database";
import { eq, sql, type SQL } from "drizzle-orm";

/**
 * The three sibling lists whose `position` is unique within a parent:
 * `(form_id, position)`, `(section_id, position)` and
 * `(question_id, kind, position)`.
 */
type OrderedTable = typeof formSections | typeof questions | typeof questionOptions;

/**
 * Rewrite a sibling list to contiguous positions in the given order.
 *
 * Unique indexes are checked per row as each update lands, so assigning the
 * final numbers directly collides the moment two rows pass through the same
 * value. Parking the whole list in negative space first makes every subsequent
 * write land on a number nothing holds — one extra statement, and no dependence
 * on the order rows happen to be updated in.
 */
export async function renumber(
  tx: DatabaseTransaction,
  table: OrderedTable,
  scope: SQL,
  orderedIds: string[],
): Promise<void> {
  await tx
    .update(table)
    .set({ position: sql`-"position" - 1` })
    .where(scope);

  for (const [index, id] of orderedIds.entries()) {
    await tx.update(table).set({ position: index }).where(eq(table.id, id));
  }
}

/** The list with `id` moved one place towards the start or the end. */
export function moved(orderedIds: string[], id: string, delta: number): string[] {
  const from = orderedIds.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= orderedIds.length) return orderedIds;

  const next = [...orderedIds];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry!);
  return next;
}
