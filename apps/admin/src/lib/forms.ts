import { formSections, forms, questionOptions, questions, submissions } from "@patriothacks/database";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { queryAsStaff } from "@/lib/db";
import { isUuid } from "@/lib/form-definition";
import { sectionLabel } from "@/lib/format";

/**
 * Counts are correlated subqueries so Postgres returns three integers per form.
 * At 500-2000 submissions per form, fetching rows to count them in JavaScript
 * would pull the whole table across the wire.
 *
 * `$count` rather than a hand-written `sql` fragment: inside a raw subquery
 * drizzle emits the outer column unqualified, so `where "form_id" = "id"` binds
 * `id` to the inner table and every count comes back 0.
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
        sectionCount: tx.$count(formSections, eq(formSections.formId, forms.id)),
        questionCount: tx.$count(questions, eq(questions.formId, forms.id)),
        submissionCount: tx.$count(submissions, eq(submissions.formId, forms.id)),
      })
      .from(forms)
      .where(isNull(forms.deletedAt))
      .orderBy(desc(forms.createdAt)),
  );
}

export type FormListRow = Awaited<ReturnType<typeof listForms>>[number];

export type FormGroup = "open" | "draft" | "closed";

/**
 * `closed` is never written today, but a published form whose window has run out
 * is closed whatever the column says. `now` is a parameter so one render sorts
 * every row against the same instant instead of drifting row by row.
 */
export function formGroup(row: Pick<FormListRow, "status" | "closesAt">, now: Date): FormGroup {
  if (row.status === "draft") return "draft";
  if (row.status === "closed") return "closed";
  if (row.closesAt && row.closesAt <= now) return "closed";
  return "open";
}

export async function getFormDetail(id: string) {
  if (!isUuid(id)) return null;

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
