"use server";

import { forms } from "@patriothacks/database";
import { like } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";

const PLACEHOLDER_TITLE = "Untitled form";
const PLACEHOLDER_SLUG = "untitled-form";

/** A unique violation on the slug — the only constraint this insert can break. */
const isSlugCollision = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

/**
 * `untitled-form`, then `untitled-form-2`, `-3`. Soft-deleted forms count:
 * `forms_slug_unique` is a plain unique index, so their slugs stay reserved.
 */
function freeSlug(taken: Set<string>): string {
  if (!taken.has(PLACEHOLDER_SLUG)) return PLACEHOLDER_SLUG;
  let suffix = 2;
  while (taken.has(`${PLACEHOLDER_SLUG}-${suffix}`)) suffix += 1;
  return `${PLACEHOLDER_SLUG}-${suffix}`;
}

/**
 * Creating a form asks nothing. The title and the slug are both renamed in the
 * builder anyway, so a page collecting them only stood between the button and
 * the work — the draft is created on the click and the builder opens on it.
 *
 * The scan and the insert race another admin doing the same thing, so the
 * insert runs in a savepoint: a collision rolls back that statement alone and
 * the next pass picks the suffix the winner did not take, rather than failing a
 * click the user cannot act on.
 */
export async function createDraftForm(): Promise<never> {
  const staff = await requireAdmin();

  const id = await queryAsStaff(async (tx) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rows = await tx
        .select({ slug: forms.slug })
        .from(forms)
        .where(like(forms.slug, `${PLACEHOLDER_SLUG}%`));
      const slug = freeSlug(new Set(rows.map((row) => row.slug)));

      try {
        return await tx.transaction(async (sp) => {
          const [created] = await sp
            .insert(forms)
            .values({ slug, title: PLACEHOLDER_TITLE, createdBy: staff.userId })
            .returning({ id: forms.id });
          if (!created) throw new Error("Could not create a draft");
          return created.id;
        });
      } catch (error) {
        if (!isSlugCollision(error)) throw error;
      }
    }

    throw new Error("Could not create a draft");
  });

  redirect(`/forms/${id}/edit`);
}
