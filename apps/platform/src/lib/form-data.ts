import {
  answers,
  formSections,
  forms,
  questionOptions,
  questions,
  submissions,
  type DatabaseTransaction,
  type Form,
  type Submission,
} from "@patriothacks/database";
import type { FormDefinition, Question, QuestionOption } from "@patriothacks/form-engine";
import { and, asc, eq, inArray } from "drizzle-orm";

/**
 * Reads that hydrate the form engine's plain models from rows the caller's RLS
 * transaction already sees. Every function takes the transaction rather than
 * opening one, so a page can load the form and a server action can load it
 * again inside the same transaction that writes.
 */

export interface LoadedForm {
  form: Form;
  definition: FormDefinition;
}

/** `forms_select_published` is what limits this to published, non-deleted forms. */
export async function loadForm(
  tx: DatabaseTransaction,
  slug: string,
): Promise<LoadedForm | null> {
  const [form] = await tx.select().from(forms).where(eq(forms.slug, slug)).limit(1);
  if (!form) return null;

  const sectionRows = await tx
    .select()
    .from(formSections)
    .where(eq(formSections.formId, form.id))
    .orderBy(asc(formSections.position));

  const questionRows = await tx
    .select()
    .from(questions)
    .where(eq(questions.formId, form.id))
    .orderBy(asc(questions.position));

  const optionRows =
    questionRows.length === 0
      ? []
      : await tx
          .select()
          .from(questionOptions)
          .where(
            inArray(
              questionOptions.questionId,
              questionRows.map((row) => row.id),
            ),
          )
          .orderBy(asc(questionOptions.position));

  const optionsByQuestion = new Map<string, QuestionOption[]>();
  for (const row of optionRows) {
    const bucket = optionsByQuestion.get(row.questionId) ?? [];
    bucket.push({
      id: row.id,
      questionId: row.questionId,
      kind: row.kind,
      label: row.label,
      value: row.value,
      position: row.position,
      nextAction: row.nextAction,
      nextSectionId: row.nextSectionId,
    });
    optionsByQuestion.set(row.questionId, bucket);
  }

  const questionsBySection = new Map<string, Question[]>();
  for (const row of questionRows) {
    const bucket = questionsBySection.get(row.sectionId) ?? [];
    bucket.push({
      id: row.id,
      sectionId: row.sectionId,
      formId: row.formId,
      type: row.type,
      label: row.label,
      helpText: row.helpText,
      position: row.position,
      required: row.required,
      editableAfterSubmit: row.editableAfterSubmit,
      config: row.config,
      options: optionsByQuestion.get(row.id) ?? [],
    });
    questionsBySection.set(row.sectionId, bucket);
  }

  return {
    form,
    definition: {
      id: form.id,
      slug: form.slug,
      title: form.title,
      description: form.description,
      sections: sectionRows.map((row) => ({
        id: row.id,
        formId: row.formId,
        title: row.title ?? "",
        description: row.description,
        position: row.position,
        nextAction: row.nextAction,
        nextSectionId: row.nextSectionId,
        questions: questionsBySection.get(row.id) ?? [],
      })),
    },
  };
}

export interface LoadedSubmission {
  submission: Submission;
  answers: Record<string, unknown>;
}

/** This user's submission for a form, or null when they have not started it. */
export async function loadSubmission(
  tx: DatabaseTransaction,
  formId: string,
  userId: string,
): Promise<LoadedSubmission | null> {
  const [submission] = await tx
    .select()
    .from(submissions)
    .where(and(eq(submissions.formId, formId), eq(submissions.userId, userId)))
    .limit(1);
  if (!submission) return null;

  return { submission, answers: await loadAnswers(tx, submission.id) };
}

export async function loadAnswers(
  tx: DatabaseTransaction,
  submissionId: string,
): Promise<Record<string, unknown>> {
  const rows = await tx
    .select({ questionId: answers.questionId, value: answers.value })
    .from(answers)
    .where(eq(answers.submissionId, submissionId));
  return Object.fromEntries(rows.map((row) => [row.questionId, row.value]));
}
