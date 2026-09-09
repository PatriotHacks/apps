/**
 * The upload contract for the `designs` bucket, in one place.
 *
 * Kept free of any database or Supabase import so the browser can hold it: the
 * picker's `accept` list, the server-side check on what gets recorded, and the
 * object path all come from here.
 *
 * `0008_design_assets.sql` and `supabase/config.toml` carry the same two rules
 * again, because neither can import a TypeScript module. The bucket's own limits
 * are the enforcement — these are what stop the console from offering a file the
 * bucket would refuse.
 */
export const DESIGNS_BUCKET = "designs";

export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/zip",
] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Long enough to open the tab the click asked for, short enough not to share. */
export const SIGNED_URL_TTL_SECONDS = 60;

/**
 * What is safe to show inline. SVG and PDF are absent on purpose: an uploaded
 * SVG is untrusted markup, and both open in their own tab instead.
 */
const THUMBNAIL_MIME_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function isRasterImage(mimeType: string | null): boolean {
  return mimeType !== null && THUMBNAIL_MIME_TYPES.includes(mimeType);
}

export function isAcceptedMimeType(mimeType: string): boolean {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Object keys are `{asset_id}/{file_name}` so a signed URL downloads under a
 * readable name, which means the name has to survive a URL path intact.
 *
 * The browser runs this before uploading and the server re-runs it before
 * recording the row, rather than the server rewriting what it is given: a name
 * the two disagreed about would leave the row pointing at nothing.
 */
export function normalizeFileName(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 120);
}

export function objectPath(assetId: string, fileName: string): string {
  return `${assetId}/${fileName}`;
}
