"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireStaff } from "@/lib/auth";
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  SIGNED_URL_TTL_SECONDS,
  isAcceptedMimeType,
  normalizeFileName,
  objectPath,
} from "@/lib/design-files";
import {
  createDesignAsset,
  deleteDesignAsset,
  designStorage,
  getDesignAsset,
} from "@/lib/designs";
import { isUuid } from "@/lib/form-definition";

export type DesignResult = { ok: true } | { ok: false; message: string };

export type SignedUrlResult = { ok: true; url: string } | { ok: false; message: string };

/** What the browser reports about the object it has already uploaded. */
export type DesignUpload = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type DesignDraft = {
  /** Minted in the browser, because the object was stored under it first. */
  id: string;
  title: string;
  description: string;
  linkUrl: string;
  upload: DesignUpload | null;
};

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * `new URL()` parses `javascript:` and `data:` perfectly happily, so the
 * protocol is the thing that has to be checked rather than the parse.
 */
function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Records an entry the browser has already uploaded the file for.
 *
 * The file never passes through here: a server action body is capped at 1 MB by
 * default and this app runs on Workers, so 25 MB goes browser-to-storage and
 * this action only writes the row. Storage RLS authorized that upload, and
 * `requireAdmin()` plus `design_assets_insert_admin` authorize this write — an
 * organizer replaying it gets the same 403 the console's missing button implies.
 */
export async function addDesign(draft: DesignDraft): Promise<DesignResult> {
  const staff = await requireAdmin();

  if (!isUuid(draft.id)) return { ok: false, message: "That is not a usable design id." };

  const title = draft.title.trim();
  if (!title) return { ok: false, message: "A title is required." };

  const description = draft.description.trim();
  const linkUrl = draft.linkUrl.trim();

  if (linkUrl && !isWebUrl(linkUrl)) {
    return { ok: false, message: "A link has to be an http:// or https:// address." };
  }

  const { upload } = draft;
  if (!linkUrl && !upload) {
    return { ok: false, message: "An entry needs a link, a file, or both." };
  }

  if (upload) {
    // The bucket refuses both of these at upload time. Checked again here so a
    // row cannot describe a file the bucket would never have accepted.
    if (!isAcceptedMimeType(upload.mimeType)) {
      return {
        ok: false,
        message: `That file type is not accepted. Allowed file types: ${ACCEPTED_MIME_TYPES.join(", ")}.`,
      };
    }
    if (upload.sizeBytes <= 0 || upload.sizeBytes > MAX_UPLOAD_BYTES) {
      return { ok: false, message: "That file is outside the 25 MB limit." };
    }
    if (upload.fileName.length === 0 || upload.fileName !== normalizeFileName(upload.fileName)) {
      return { ok: false, message: "That file name cannot be stored." };
    }
  }

  try {
    await createDesignAsset({
      id: draft.id,
      title,
      description: description || null,
      linkUrl: linkUrl || null,
      storagePath: upload ? objectPath(draft.id, upload.fileName) : null,
      fileName: upload?.fileName ?? null,
      mimeType: upload?.mimeType ?? null,
      sizeBytes: upload?.sizeBytes ?? null,
      uploadedBy: staff.userId,
    });
  } catch (cause) {
    return { ok: false, message: reason(cause) };
  }

  revalidatePath("/designs");
  return { ok: true };
}

/**
 * The bucket is never public, so reaching a file means a short-lived signed URL
 * minted per click. Open to any console user: the point of the section is that
 * everyone can get at the materials.
 */
export async function signDesignUrl(id: string): Promise<SignedUrlResult> {
  await requireStaff();
  if (!isUuid(id)) return { ok: false, message: "That is not a usable design id." };

  const asset = await getDesignAsset(id);
  if (!asset) return { ok: false, message: "This entry no longer exists." };
  if (!asset.storagePath) return { ok: false, message: "This entry has no file." };

  const storage = await designStorage();
  const { data, error } = await storage.createSignedUrl(
    asset.storagePath,
    SIGNED_URL_TTL_SECONDS,
  );
  if (error) return { ok: false, message: error.message };

  return { ok: true, url: data.signedUrl };
}

/**
 * Object first, then the row. A row with no object is a visible entry someone
 * can delete again; an object with no row is storage nothing will ever name.
 */
export async function deleteDesign(id: string): Promise<DesignResult> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false, message: "That is not a usable design id." };

  const asset = await getDesignAsset(id);
  if (!asset) return { ok: false, message: "This entry has already been deleted." };

  if (asset.storagePath) {
    const storage = await designStorage();
    const { error } = await storage.remove([asset.storagePath]);
    if (error) return { ok: false, message: error.message };
  }

  await deleteDesignAsset(id);
  revalidatePath("/designs");
  return { ok: true };
}
