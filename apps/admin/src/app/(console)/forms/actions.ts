"use server";

import { forms, submissions } from "@patriothacks/database";
import { and, eq, isNull, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";
import { isUuid } from "@/lib/form-definition";

import type { ActionResult } from "./[id]/edit/actions";

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

/**
 * Soft delete. `deleted_at` is what every read already filters on, so stamping
 * it takes the form out of the console, out of the platform index and out of
 * the applicant's reach in one write — while the submissions, the answers and
 * the revision history stay exactly where they are. A form people have answered
 * is not something to destroy on a click, and a hard delete would take their
 * responses with it.
 *
 * The slug stays reserved: `forms_slug_unique` covers deleted rows too, which is
 * deliberate — a new form must not quietly inherit the URL applicants were
 * mailed.
 *
 * The submission count is re-taken here and checked against the one the
 * confirmation named, so a form that filled up while the dialog sat open is not
 * removed on the strength of a number that has since changed.
 */
export async function deleteForm(
  formId: string,
  confirmedSubmissions: number,
): Promise<ActionResult> {
  await requireAdmin();
  if (!isUuid(formId)) return { ok: false, message: "Unknown form." };

  const result = await queryAsStaff(async (tx): Promise<ActionResult> => {
    const [form] = await tx
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.id, formId), isNull(forms.deletedAt)))
      .limit(1);
    if (!form) return { ok: false, message: "This form has already been deleted." };

    const actual = await tx.$count(submissions, eq(submissions.formId, formId));
    if (actual !== confirmedSubmissions) {
      return {
        ok: false,
        message: `Not deleted — this form now holds ${actual} ${actual === 1 ? "submission" : "submissions"} rather than ${confirmedSubmissions}. Check again before deleting.`,
      };
    }

    await tx.update(forms).set({ deletedAt: new Date() }).where(eq(forms.id, formId));
    return { ok: true };
  });

  if (result.ok) {
    revalidatePath("/forms");
    revalidatePath(`/forms/${formId}/edit`);
  }
  return result;
}
