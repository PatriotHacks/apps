import { designAssets, profiles } from "@patriothacks/database";
import { desc, eq } from "drizzle-orm";

import { DESIGNS_BUCKET } from "@/lib/design-files";
import { queryAsAdmin, queryAsStaff } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

/**
 * The uploader is joined rather than stored as a name: `uploaded_by` goes null
 * when the profile is deleted, and `profiles_select_staff` is what lets a
 * console user read it.
 */
const LIST_COLUMNS = {
  id: designAssets.id,
  title: designAssets.title,
  description: designAssets.description,
  linkUrl: designAssets.linkUrl,
  storagePath: designAssets.storagePath,
  fileName: designAssets.fileName,
  mimeType: designAssets.mimeType,
  sizeBytes: designAssets.sizeBytes,
  createdAt: designAssets.createdAt,
  uploadedByName: profiles.fullName,
  uploadedByEmail: profiles.email,
};

export function listDesignAssets() {
  return queryAsStaff((tx) =>
    tx
      .select(LIST_COLUMNS)
      .from(designAssets)
      .leftJoin(profiles, eq(profiles.id, designAssets.uploadedBy))
      .orderBy(desc(designAssets.createdAt)),
  );
}

export type DesignAssetRow = Awaited<ReturnType<typeof listDesignAssets>>[number];

export async function getDesignAsset(id: string): Promise<DesignAssetRow | undefined> {
  const [row] = await queryAsStaff((tx) =>
    tx
      .select(LIST_COLUMNS)
      .from(designAssets)
      .leftJoin(profiles, eq(profiles.id, designAssets.uploadedBy))
      .where(eq(designAssets.id, id))
      .limit(1),
  );
  return row;
}

/**
 * The id is minted in the browser, because it names the object's folder and the
 * upload happens before the row exists.
 */
export function createDesignAsset(values: {
  id: string;
  title: string;
  description: string | null;
  linkUrl: string | null;
  storagePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string;
}) {
  return queryAsAdmin((tx) => tx.insert(designAssets).values(values));
}

export function deleteDesignAsset(id: string) {
  return queryAsAdmin((tx) => tx.delete(designAssets).where(eq(designAssets.id, id)));
}

/**
 * The bucket on the caller's own session, so storage RLS answers every request.
 * There is no service-role storage client anywhere in this feature.
 */
export async function designStorage() {
  const supabase = await createClient();
  return supabase.storage.from(DESIGNS_BUCKET);
}
