"use client";

import {
  QuestionField,
  firstSection,
  parseAnswerValue,
  resolveNextSection,
  type AnswerValueByType,
  type FormDefinition,
  type Question,
  type QuestionType,
} from "@patriothacks/form-engine";
import { Button } from "@patriothacks/ui";
import { useState } from "react";

import { sectionLabel } from "@/lib/format";

/** The stored jsonb blob narrowed to what the renderer takes, or null. */
function fieldValue(question: Question, raw: unknown): AnswerValueByType[QuestionType] | null {
  if (raw === undefined || raw === null) return null;
  const parsed = parseAnswerValue(question.type, raw);
  return parsed.success ? parsed.data : null;
}

/**
 * The applicant's view, section at a time, driven by the same renderer and the
 * same traversal the platform app uses. Sharing the component is the point: a
 * preview written separately would drift from what applicants actually see, and
 * a published form cannot be corrected once it has.
 */
export function Preview({ definition }: { definition: FormDefinition }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [visited, setVisited] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const start = firstSection(definition);
  if (start === null) {
    return <p className="text-sm text-muted-foreground">Add a section to see the preview.</p>;
  }

  const section = definition.sections.find((entry) => entry.id === current) ?? start;
  const next = resolveNextSection(definition, section.id, answers);
  const questions = [...section.questions].sort((a, b) => a.position - b.position);

  function restart(): void {
    setAnswers({});
    setVisited([]);
    setCurrent(null);
    setFinished(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Preview — {sectionLabel(section.title, section.position)}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={restart}>
          Restart
        </Button>
      </div>

      {finished ? (
        <p className="rounded-md border border-dashed p-3 text-sm">
          The form ends here. An applicant would submit at this point.
        </p>
      ) : (
        <>
          {section.description ? (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          ) : null}

          <div className="flex flex-col gap-5">
            {questions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                value={fieldValue(question, answers[question.id])}
                onChange={(value) =>
                  setAnswers((current) => ({ ...current, [question.id]: value }))
                }
              />
            ))}
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">This section has no questions.</p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={visited.length === 0}
              onClick={() => {
                setCurrent(visited[visited.length - 1] ?? null);
                setVisited((entries) => entries.slice(0, -1));
              }}
            >
              Back
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (next.kind === "submit") {
                  setFinished(true);
                  return;
                }
                setVisited((entries) => [...entries, section.id]);
                setCurrent(next.sectionId);
              }}
            >
              {next.kind === "submit" ? "Submit" : "Next"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
