/** The slug is a public URL segment on the platform app: `/[slug]`. */
export const SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

export function isSlug(value: string): boolean {
  return new RegExp(SLUG_PATTERN).test(value);
}

/**
 * An option's `value` is what `answers.value` stores for choice types, so it
 * has to be a stable token rather than the prose label. Derived the same way
 * the seed derives it; the caller dedupes against the question's siblings.
 */
export function toOptionValue(label: string): string {
  return label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}
