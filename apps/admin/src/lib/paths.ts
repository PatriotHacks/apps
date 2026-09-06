/** `next` arrives from the query string. Same-origin absolute paths only. */
export function safeNext(value: string | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
