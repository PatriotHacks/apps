import { emailTemplates } from "@patriothacks/database";
import { isTemplateKey, TEMPLATE_KEYS, type TemplateKey } from "@patriothacks/emails";
import { eq } from "drizzle-orm";

import { queryAsStaff } from "@/lib/db";

export type StoredTemplateRow = {
  key: TemplateKey;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  updatedAt: Date;
};

const COLUMNS = {
  key: emailTemplates.key,
  subject: emailTemplates.subject,
  bodyHtml: emailTemplates.bodyHtml,
  bodyText: emailTemplates.bodyText,
  updatedAt: emailTemplates.updatedAt,
};

/**
 * Catalogue order, not alphabetical: accepted / waitlisted / rejected reads as
 * the decision pipeline, which is how an organizer thinks about these.
 */
const byCatalogue = (a: StoredTemplateRow, b: StoredTemplateRow) =>
  TEMPLATE_KEYS.indexOf(a.key) - TEMPLATE_KEYS.indexOf(b.key);

export async function listTemplates(): Promise<StoredTemplateRow[]> {
  const rows = await queryAsStaff((tx) => tx.select(COLUMNS).from(emailTemplates));

  // A row whose key the catalogue does not declare has no variables and no send
  // site, so it is not editable here.
  return rows
    .filter((row): row is StoredTemplateRow => isTemplateKey(row.key))
    .sort(byCatalogue);
}

export async function getTemplate(key: string): Promise<StoredTemplateRow | null> {
  if (!isTemplateKey(key)) return null;

  const [row] = await queryAsStaff((tx) =>
    tx.select(COLUMNS).from(emailTemplates).where(eq(emailTemplates.key, key)).limit(1),
  );

  return row ? { ...row, key } : null;
}
