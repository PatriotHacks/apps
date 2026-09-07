"use server";

import { forms, profiles, submissions } from "@patriothacks/database";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireClaims } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { sendRsvpConfirmation } from "@/lib/rsvp-email";

export type RsvpResponse = "confirmed" | "declined";

export type RsvpResult =
  | { status: "recorded"; response: RsvpResponse; emailFailed: string | null }
  | { status: "error"; message: string };

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * An accepted applicant confirming or declining their spot.
 *
 * The RSVP is committed before the confirmation email is attempted, and the two
 * are not in one transaction. A provider outage loses the email, not the
 * answer — the applicant said yes, and that has to still be true tomorrow.
 * Declining sends nothing; there is no template for it and none is owed.
 */
export async function respondToRsvp(slug: string, response: string): Promise<RsvpResult> {
  const claims = await requireClaims();
  if (response !== "confirmed" && response !== "declined") {
    return { status: "error", message: "That is not an answer." };
  }

  const recorded = await withRls(claims, async (tx) => {
    const [row] = await tx
      .select({
        id: submissions.id,
        status: submissions.status,
        formTitle: forms.title,
        email: profiles.email,
        fullName: profiles.fullName,
      })
      .from(submissions)
      .innerJoin(forms, eq(forms.id, submissions.formId))
      .innerJoin(profiles, eq(profiles.id, submissions.userId))
      .where(and(eq(forms.slug, slug), eq(submissions.userId, claims.sub)))
      .limit(1);

    if (!row) return null;
    // Only an offer can be answered. `submissions_update_own` lets the
    // applicant write the row; this is what limits when it means anything.
    if (row.status !== "accepted") return null;

    await tx
      .update(submissions)
      .set({ rsvpStatus: response, rsvpAt: new Date(), updatedAt: new Date() })
      .where(eq(submissions.id, row.id));

    return row;
  });

  if (recorded === null) {
    return { status: "error", message: "There is no offer on this application to answer." };
  }

  revalidatePath(`/${slug}/review`);
  revalidatePath("/submissions");

  if (response === "declined") {
    return { status: "recorded", response, emailFailed: null };
  }

  // Past the commit. Anything that goes wrong from here is a mail problem, and
  // it is reported as one rather than as a failed RSVP.
  try {
    const result = await sendRsvpConfirmation({
      to: recorded.email,
      toUserId: claims.sub,
      fullName: recorded.fullName ?? recorded.email,
      formTitle: recorded.formTitle,
    });
    return {
      status: "recorded",
      response,
      emailFailed: result.status === "failed" ? result.error : null,
    };
  } catch (cause) {
    return { status: "recorded", response, emailFailed: reason(cause) };
  }
}
