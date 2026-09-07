import { answers, questions, submissions } from "@patriothacks/database";
import { validateFormGraph } from "@patriothacks/form-engine";
import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";
import { loadFormDefinition } from "@/lib/form-definition";

import { Builder } from "./builder";

/**
 * The builder opens on any form, draft or live.
 *
 * Publishing used to freeze a form and this page refused to render one. It no
 * longer does — but a published form is being answered while it is edited, so
 * the builder is handed the weight behind it: how many people have submitted,
 * and how many answers stand behind each individual question. Those counts are
 * what turn a warning from a sentence nobody reads into a stated consequence,
 * and what every delete confirmation is written against.
 *
 * One grouped query rather than a count per card: a form runs to a few hundred
 * questions and a round trip each would be the slowest thing on the page.
 */
export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const loaded = await queryAsStaff(async (tx) => {
    const form = await loadFormDefinition(tx, id);
    if (!form) return null;

    const answered = await tx
      .select({ questionId: answers.questionId, total: count() })
      .from(answers)
      .innerJoin(questions, eq(questions.id, answers.questionId))
      .where(eq(questions.formId, id))
      .groupBy(answers.questionId);

    return {
      ...form,
      submissionCount: await tx.$count(submissions, eq(submissions.formId, id)),
      answerCounts: Object.fromEntries(answered.map((row) => [row.questionId, row.total])),
    };
  });
  if (!loaded) notFound();

  const { form, definition, submissionCount, answerCounts } = loaded;

  return (
    <Builder
      form={form}
      definition={definition}
      submissionCount={submissionCount}
      answerCounts={answerCounts}
      errors={validateFormGraph(definition).errors}
    />
  );
}
