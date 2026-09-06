"use server";

import { answers as answersTable, submissions } from "@patriothacks/database";
import {
  computeReachability,
  isEmptyAnswerValue,
  orphanedQuestionIds,
  validateAnswers,
  type FormDefinition,
  type Question,
  type ValidationError,
} from "@patriothacks/form-engine";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireClaims } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { canEditQuestion, windowExplanation, windowState } from "@/lib/editability";
import { loadAnswers, loadForm } from "@/lib/form-data";

/** A question whose stored answer a branch switch is about to delete. */
export interface DiscardCandidate {
  id: string;
  label: string;
}

export type SaveResult =
  | { status: "saved" }
  | { status: "discard_required"; questions: DiscardCandidate[] }
  | { status: "error"; message: string };

export type SubmitResult =
  | { status: "submitted" }
  | { status: "invalid"; errors: ValidationError[] }
  | { status: "error"; message: string };

function questionIndex(definition: FormDefinition): Map<string, Question> {
  return new Map(
    definition.sections.flatMap((section) =>
      section.questions.map((question) => [question.id, question] as const),
    ),
  );
}

/**
 * Persist a batch of answers, creating the draft submission on the way if this
 * is the applicant's first interaction with the form.
 *
 * Everything runs inside the one RLS transaction, which is what lets the branch
 * discard and the answer that triggered it commit together — the delete trigger
 * writes `answer_revisions` rows with `reason = 'branch_discarded'`, so a
 * partial commit would leave history describing a change that never happened.
 */
export async function saveAnswers(
  slug: string,
  values: Record<string, unknown>,
  confirmDiscard: boolean,
): Promise<SaveResult> {
  const claims = await requireClaims();
  const userId = claims.sub;

  return withRls(claims, async (tx): Promise<SaveResult> => {
    const loaded = await loadForm(tx, slug);
    if (loaded === null) return { status: "error", message: "That form is not available." };

    const { form, definition } = loaded;
    const state = windowState(form);
    if (state !== "open") {
      return {
        status: "error",
        message: windowExplanation(form, state) ?? "This form is not accepting answers.",
      };
    }

    // Upsert rather than select-then-insert: two tabs racing to create the
    // first draft both land here, and the unique constraint on
    // (form_id, user_id) turns the loser into an update instead of a 500.
    const [submission] = await tx
      .insert(submissions)
      .values({ formId: form.id, userId })
      .onConflictDoUpdate({
        target: [submissions.formId, submissions.userId],
        set: { updatedAt: new Date() },
      })
      .returning();
    if (!submission) return { status: "error", message: "Could not open your draft." };

    const byId = questionIndex(definition);
    // A question the edit policy locks is dropped here as well as by RLS. The
    // policy is the boundary; this keeps a stale tab from taking a 42501.
    const incoming = Object.entries(values).filter(([questionId]) => {
      const question = byId.get(questionId);
      return question !== undefined && canEditQuestion(form.editPolicy, question, submission.status);
    });

    const previous = await loadAnswers(tx, submission.id);
    const next: Record<string, unknown> = { ...previous, ...Object.fromEntries(incoming) };

    const reachable = computeReachability(definition, next).questionIds;
    // Two ways work disappears: an answer already stored on the abandoned path,
    // and an unsaved answer in this very batch that the same change stranded.
    const discarding = new Set(orphanedQuestionIds(definition, previous, next));
    for (const [questionId, value] of incoming) {
      if (!reachable.has(questionId) && !isEmptyAnswerValue(value)) discarding.add(questionId);
    }

    if (discarding.size > 0 && !confirmDiscard) {
      return {
        status: "discard_required",
        questions: [...discarding].map((id) => ({ id, label: byId.get(id)?.label ?? "" })),
      };
    }

    const writes = incoming.filter(([questionId]) => reachable.has(questionId));
    if (writes.length > 0) {
      await tx
        .insert(answersTable)
        .values(
          writes.map(([questionId, value]) => ({
            submissionId: submission.id,
            questionId,
            value,
          })),
        )
        .onConflictDoUpdate({
          target: [answersTable.submissionId, answersTable.questionId],
          set: { value: sql`excluded.value`, updatedAt: new Date() },
        });
    }

    const orphans = [...discarding].filter((questionId) => previous[questionId] !== undefined);
    if (orphans.length > 0) {
      await tx
        .delete(answersTable)
        .where(
          and(
            eq(answersTable.submissionId, submission.id),
            inArray(answersTable.questionId, orphans),
          ),
        );
    }

    return { status: "saved" };
  });
}

/**
 * Validate over the reachable question set and flip the submission.
 *
 * The client validates too, but only this side counts: it reads the answers
 * back out of the database and recomputes which questions the applicant's own
 * path actually asked, so a required question on a branch they never took
 * cannot block them.
 */
export async function submitForm(slug: string): Promise<SubmitResult> {
  const claims = await requireClaims();
  const userId = claims.sub;

  const result = await withRls(claims, async (tx): Promise<SubmitResult> => {
    const loaded = await loadForm(tx, slug);
    if (loaded === null) return { status: "error", message: "That form is not available." };

    const { form, definition } = loaded;
    const state = windowState(form);
    if (state !== "open") {
      return {
        status: "error",
        message: windowExplanation(form, state) ?? "This form is not accepting submissions.",
      };
    }

    const [submission] = await tx
      .select()
      .from(submissions)
      .where(and(eq(submissions.formId, form.id), eq(submissions.userId, userId)))
      .limit(1);
    if (!submission) return { status: "error", message: "There is nothing to submit yet." };
    if (submission.status !== "draft") {
      return { status: "error", message: "This application has already been submitted." };
    }

    const stored = await loadAnswers(tx, submission.id);
    const reachable = computeReachability(definition, stored);
    const validation = validateAnswers(reachable.questions, stored);
    if (!validation.success) return { status: "invalid", errors: validation.errors };

    await tx
      .update(submissions)
      .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(submissions.id, submission.id));

    return { status: "submitted" };
  });

  if (result.status === "submitted") {
    revalidatePath("/");
    revalidatePath("/submissions");
    revalidatePath(`/${slug}`);
  }
  return result;
}
