import {
  formSections,
  forms,
  questionOptions,
  questions,
  type DatabaseTransaction,
  type Form,
} from "@patriothacks/database";
import {
  type FormDefinition,
  type FormSection,
  type Question,
  type QuestionOption,
} from "@patriothacks/form-engine";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

/**
 * Hydrates the form engine's `FormDefinition` from rows the caller's staff
 * transaction already sees.
 *
 * The console needs the engine's model rather than raw rows because the grid,
 * the detail view and the export all run `computeReachability` — telling "never
 * asked" from "asked and left blank" is not something a null answer can answer.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

export interface LoadedForm {
  form: Form;
  definition: FormDefinition;
}

export async function loadFormDefinition(
  tx: DatabaseTransaction,
  formId: string,
): Promise<LoadedForm | null> {
  if (!isUuid(formId)) return null;

  const [form] = await tx
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), isNull(forms.deletedAt)))
    .limit(1);
  if (!form) return null;

  const sectionRows = await tx
    .select()
    .from(formSections)
    .where(eq(formSections.formId, formId))
    .orderBy(asc(formSections.position));

  const questionRows = await tx
    .select()
    .from(questions)
    .where(eq(questions.formId, formId))
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
        title: row.title ?? `Section ${row.position + 1}`,
        description: row.description,
        position: row.position,
        nextAction: row.nextAction,
        nextSectionId: row.nextSectionId,
        questions: questionsBySection.get(row.id) ?? [],
      })),
    },
  };
}

/** Sections by position, then questions by position — the reading order. */
export function orderedSections(definition: FormDefinition): FormSection[] {
  return [...definition.sections].sort((a, b) => a.position - b.position);
}

export function orderedQuestions(definition: FormDefinition): Question[] {
  return orderedSections(definition).flatMap((section) =>
    [...section.questions].sort((a, b) => a.position - b.position),
  );
}

export function questionsById(definition: FormDefinition): Map<string, Question> {
  return new Map(orderedQuestions(definition).map((question) => [question.id, question]));
}
