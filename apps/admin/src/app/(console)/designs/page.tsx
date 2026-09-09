import { requireStaff } from "@/lib/auth";
import { SIGNED_URL_TTL_SECONDS, isRasterImage } from "@/lib/design-files";
import { designStorage, listDesignAssets, type DesignAssetRow } from "@/lib/designs";
import { formatDateTime } from "@/lib/format";

import { AddDesign } from "./add-design";
import { DeleteDesign } from "./delete-design";
import { DesignFile } from "./design-file";

/**
 * One signing request for the whole page rather than one per row. A path that
 * comes back without a URL just has no thumbnail; a request that fails outright
 * means the bucket is unreachable, which is worth saying rather than hiding
 * behind a list of pictureless entries.
 */
async function thumbnailUrls(rows: DesignAssetRow[]): Promise<Map<string, string>> {
  const paths = rows.flatMap((row) =>
    row.storagePath && isRasterImage(row.mimeType) ? [row.storagePath] : [],
  );
  if (paths.length === 0) return new Map();

  const storage = await designStorage();
  const { data, error } = await storage.createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  return new Map(
    data.flatMap((entry) =>
      entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [],
    ),
  );
}

export default async function DesignsPage() {
  const [staff, rows] = await Promise.all([requireStaff(), listDesignAssets()]);
  const isAdmin = staff.role === "admin";
  const thumbnails = await thumbnailUrls(rows);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Designs</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </p>
      </div>

      {isAdmin ? <AddDesign /> : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="flex max-w-4xl flex-col gap-3">
          {rows.map((row) => {
            const thumbnail = row.storagePath ? thumbnails.get(row.storagePath) : undefined;
            const uploader = row.uploadedByName ?? row.uploadedByEmail;

            return (
              // The text column keeps a readable width rather than shrinking to
              // nothing, so on a phone it is the delete control that wraps below.
              <li
                key={row.id}
                className="flex flex-wrap items-start gap-4 rounded-md border border-border p-4"
              >
                {thumbnail ? (
                  // A signed URL expires in a minute, so the optimizer would
                  // cache a key it can never fetch again. Plain <img>, served
                  // straight from storage.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnail}
                    alt=""
                    className="size-16 shrink-0 rounded border border-border object-cover"
                  />
                ) : null}

                <div className="flex min-w-40 flex-1 flex-col gap-1">
                  <p className="font-medium break-words">{row.title}</p>

                  {row.linkUrl ? (
                    <a
                      href={row.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm hover:underline"
                    >
                      {row.linkUrl}
                    </a>
                  ) : null}

                  {row.storagePath && row.fileName ? (
                    <DesignFile id={row.id} fileName={row.fileName} sizeBytes={row.sizeBytes} />
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    Added by {uploader ?? "a deleted account"} · {formatDateTime(row.createdAt)}
                  </p>
                </div>

                {isAdmin ? (
                  <DeleteDesign id={row.id} title={row.title} fileName={row.fileName} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
