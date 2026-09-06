/** UTC everywhere: the server renders these once and the strings must not shift. */
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatDateTime(value: Date | null): string {
  return value ? `${DATE_TIME.format(value)} UTC` : "—";
}

export function formatWindow(opensAt: Date | null, closesAt: Date | null): string {
  if (!opensAt && !closesAt) return "No window set";
  if (opensAt && !closesAt) return `Opens ${formatDateTime(opensAt)}`;
  if (!opensAt && closesAt) return `Closes ${formatDateTime(closesAt)}`;
  return `${formatDateTime(opensAt)} — ${formatDateTime(closesAt)}`;
}
