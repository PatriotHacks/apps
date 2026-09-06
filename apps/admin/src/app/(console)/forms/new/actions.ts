"use server";

import { forms } from "@patriothacks/database";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";
import { isSlug } from "@/lib/slug";

export type CreateFormState = { message: string | null };

/**
 * Creates the draft row and nothing else. Sections, questions and branching all
 * reference ids, so the builder needs a form to exist before it can edit one.
 */
export async function createForm(
  _previous: CreateFormState,
  data: FormData,
): Promise<CreateFormState> {
  const staff = await requireAdmin();

  const title = String(data.get("title") ?? "").trim();
  const slug = String(data.get("slug") ?? "")
    .trim()
    .toLowerCase();

  if (title.length === 0) return { message: "A title is required." };
  if (!isSlug(slug)) {
    return { message: "The slug must be lowercase letters and numbers separated by hyphens." };
  }

  const id = await queryAsStaff(async (tx) => {
    const [taken] = await tx
      .select({ id: forms.id })
      .from(forms)
      .where(eq(forms.slug, slug))
      .limit(1);
    if (taken) return null;

    const [created] = await tx
      .insert(forms)
      .values({ slug, title, createdBy: staff.userId })
      .returning({ id: forms.id });
    return created?.id ?? null;
  });

  if (id === null) return { message: `The slug "${slug}" is already taken.` };

  redirect(`/forms/${id}/edit`);
}
