import { formSections, forms, questionOptions, questions, submissions } from "@patriothacks/database";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { queryAsStaff } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Counts are correlated subqueries so Postgres returns three integers per form.
 * At 500-2000 submissions per form, fetching rows to count them in JavaScript
 * would pull the whole table across the wire.
 */
export function listForms() {
  return queryAsStaff((tx) =>
    tx
      .select({
        id: forms.id,
        slug: forms.slug,
        title: forms.title,
        status: forms.status,
        editPolicy: forms.editPolicy,
        opensAt: forms.opensAt,
        closesAt: forms.closesAt,
        sectionCount: sql<number>`(select count(*) from ${formSections} where ${formSections.formId} = ${forms.id})`.mapWith(Number),
        questionCount: sql<number>`(select count(*) from ${questions} where ${questions.formId} = ${forms.id})`.mapWith(Number),
        submissionCount: sql<number>`(select count(*) from ${submissions} where ${submissions.formId} = ${forms.id})`.mapWith(Number),
      })
      .from(forms)
      .where(isNull(forms.deletedAt))
      .orderBy(desc(forms.createdAt)),
  );
}

export type FormListRow = Awaited<ReturnType<typeof listForms>>[number];

/** A section's display name. `title` is nullable, position is not. */
const sectionLabel = (title: string | null, position: number) => title ?? `Section ${position + 1}`;

export async function getFormDetail(id: string) {
  if (!UUID.test(id)) return null;

  return queryAsStaff(async (tx) => {
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

    const optionRows = await tx
      .select({
        id: questionOptions.id,
        questionId: questionOptions.questionId,
        kind: questionOptions.kind,
        label: questionOptions.label,
        position: questionOptions.position,
        nextAction: questionOptions.nextAction,
        nextSectionId: questionOptions.nextSectionId,
      })
      .from(questionOptions)
      .innerJoin(questions, eq(questions.id, questionOptions.questionId))
      .where(eq(questions.formId, id))
      .orderBy(asc(questionOptions.kind), asc(questionOptions.position));

    const sections = sectionRows.map((section) => ({
      ...section,
      label: sectionLabel(section.title, section.position),
      questions: questionRows
        .filter((question) => question.sectionId === section.id)
        .map((question) => ({
          ...question,
          options: optionRows.filter((option) => option.questionId === question.id),
        })),
    }));

    const sectionNames = Object.fromEntries(sections.map((section) => [section.id, section.label]));

    return { form, sections, sectionNames };
  });
}

export type FormDetail = NonNullable<Awaited<ReturnType<typeof getFormDetail>>>;
