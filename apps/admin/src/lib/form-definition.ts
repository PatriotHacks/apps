import {
  formSections,
  forms,
  questionOptions,
  questions,
  type DatabaseTransaction,
  type Form,
} from "@patriothacks/database";
import type { FormDefinition, Question, QuestionOption } from "@patriothacks/form-engine";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export interface LoadedForm {
  form: Form;
  definition: FormDefinition;
}

/**
 * Hydrates the form engine's models from the console's own rows, so the builder
 * previews, traverses and validates against the exact same graph the applicant
 * app builds. Takes the transaction rather than opening one: publish loads the
 * definition and writes the status under a single RLS transaction.
 */
export async function loadFormDefinition(
  tx: DatabaseTransaction,
  id: string,
): Promise<LoadedForm | null> {
  if (!isUuid(id)) return null;

  const [form] = await tx
    .select()
    .from(forms)
    .where(and(eq(forms.id, id), isNull(forms.deletedAt)))
    .limit(1);
  if (!form) return null;

  const sectionRows = await tx
    .select()
    .from(formSections)
    .where(eq(formSections.formId, id))
    .orderBy(asc(formSections.position));

  const questionRows = await tx
    .select()
    .from(questions)
    .where(eq(questions.formId, id))
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
