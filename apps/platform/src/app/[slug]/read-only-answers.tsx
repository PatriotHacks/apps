"use client";

import {
  QuestionField,
  computeReachability,
  parseAnswerValue,
  type AnswerValueByType,
  type FormDefinition,
  type Question,
  type QuestionType,
} from "@patriothacks/form-engine";

/**
 * The applicant's answers rendered through the same components that collected
 * them, disabled. Reachability decides what is shown, so a section their
 * branch never reached is absent rather than blank.
 */
function fieldValue(
  question: Question,
  raw: unknown,
): AnswerValueByType[QuestionType] | null {
  if (raw === undefined || raw === null) return null;
  const parsed = parseAnswerValue(question.type, raw);
  return parsed.success ? parsed.data : null;
}

export function ReadOnlyAnswers({
  definition,
  answers,
}: {
  definition: FormDefinition;
  answers: Record<string, unknown>;
}) {
  const { sections } = computeReachability(definition, answers);

  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-6">
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={fieldValue(question, answers[question.id])}
              onChange={() => undefined}
              disabled
            />
          ))}
        </section>
      ))}
    </div>
  );
}
