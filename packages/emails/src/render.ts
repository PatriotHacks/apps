import { escapeHtml, interpolate } from "./interpolate.ts";
import { renderLayout, wrapText } from "./layout.tsx";
import { type MessageKey, type TemplateContext } from "./templates.ts";

/** The stored row, narrowed to what rendering needs. */
export type StoredTemplate<K extends MessageKey = MessageKey> = {
  key: K;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Fills a stored template from `context` and pours the result into the layout
 * shell. Throws `UnknownVariableError` on any placeholder the key does not
 * declare, so a broken template fails before it reaches an applicant.
 *
 * Only the HTML body escapes its values; the subject and the text body are not
 * markup, and escaping them would show `&amp;` to the reader.
 *
 * `unsubscribeUrl` is passed for broadcasts and omitted for transactional mail;
 * the shell renders the link only when it is present.
 */
export async function renderTemplate<K extends MessageKey>(
  template: StoredTemplate<K>,
  context: TemplateContext<K>,
  unsubscribeUrl?: string,
): Promise<RenderedEmail> {
  const filled = context as TemplateContext;
  const subject = interpolate(template.subject, filled);
  const text = wrapText(interpolate(template.bodyText, filled), unsubscribeUrl);
  const html = await renderLayout(
    interpolate(template.bodyHtml, filled, escapeHtml),
    unsubscribeUrl,
  );

  return { subject, html, text };
}
