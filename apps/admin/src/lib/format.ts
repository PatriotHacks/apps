/**
 * Eastern everywhere. The zone is pinned rather than taken from the viewer so
 * the string the server renders is the string the browser rehydrates, and
 * `timeZoneName` names the offset actually in force rather than assuming one —
 * `dateStyle`/`timeStyle` cannot carry it, hence the explicit components.
 */
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

export function formatDateTime(value: Date | null): string {
  return value ? DATE_TIME.format(value) : "—";
}

export function formatWindow(opensAt: Date | null, closesAt: Date | null): string {
  if (!opensAt && !closesAt) return "No window set";
  if (opensAt && !closesAt) return `Opens ${formatDateTime(opensAt)}`;
  if (!opensAt && closesAt) return `Closes ${formatDateTime(closesAt)}`;
  return `${formatDateTime(opensAt)} — ${formatDateTime(closesAt)}`;
}

/**
 * A section's display name. `title` is nullable, position is not. Lives beside
 * the other formatters rather than with the loader so client components can use
 * it without pulling the database client into the browser bundle.
 */
export function sectionLabel(title: string | null | undefined, position: number): string {
  return title && title.length > 0 ? title : `Section ${position + 1}`;
}
