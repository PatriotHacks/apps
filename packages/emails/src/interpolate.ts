import { variablesFor, type TemplateContext, type TemplateKey } from "./templates.ts";

/** `{{ full_name }}` — whitespace tolerated, names are lower snake case. */
const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * A placeholder with no declared variable behind it. Thrown rather than
 * rendered: an applicant must never receive a literal `{{full_name}}`, and
 * silently rendering an empty string produces "Hi , we couldn't offer you a
 * spot" — worse than not sending. Save-time validation is what keeps this from
 * ever firing in production.
 */
export class UnknownVariableError extends Error {
  constructor(readonly variable: string) {
    super(`Unknown template variable {{${variable}}}`);
    this.name = "UnknownVariableError";
  }
}

export function placeholdersIn(source: string): string[] {
  return [...source.matchAll(PLACEHOLDER)].map(([, name]) => name!.toLowerCase());
}

/**
 * Placeholders the key does not declare, deduped, in first-seen order. This is
 * the save-time gate — an unknown variable is caught by the admin editing the
 * template, not discovered when 800 rejection emails go out.
 */
export function unknownVariables(key: TemplateKey, ...sources: string[]): string[] {
  const declared = new Set<string>(variablesFor(key));
  const seen = new Set<string>();

  for (const source of sources) {
    for (const name of placeholdersIn(source)) {
      if (!declared.has(name)) seen.add(name);
    }
  }

  return [...seen];
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Applied to every value interpolated into the HTML body. The value is
 * applicant-controlled — a full name of `<script>alert(1)</script>` reaches an
 * HTML document otherwise.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

/**
 * Substitutes every `{{name}}` in `source` from `context`. `escape` is applied
 * to the value, never to the surrounding template — the template's own markup
 * is authored by an admin and is meant to render.
 */
export function interpolate(
  source: string,
  context: TemplateContext,
  escape: (value: string) => string = (value) => value,
): string {
  return source.replace(PLACEHOLDER, (_match, rawName: string) => {
    const name = rawName.toLowerCase();
    const value = (context as Record<string, string | undefined>)[name];
    if (value === undefined) throw new UnknownVariableError(name);
    return escape(value);
  });
}
