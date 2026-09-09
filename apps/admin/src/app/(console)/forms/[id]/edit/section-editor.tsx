"use client";

import {
  QUESTION_TYPES,
  QUESTION_TYPE_REGISTRY,
  type FormSection,
  type GraphError,
} from "@patriothacks/form-engine";
import { Button, Select, Textarea, cn } from "@patriothacks/ui";
import { useState } from "react";

import { sectionLabel } from "@/lib/format";

import { addQuestion, deleteSection, moveSection, setSectionBranch, updateSection } from "./actions";
import {
  BranchSelect,
  ConfirmDelete,
  InlineInput,
  answerPhrase,
  useAction,
  useSynced,
  type BranchTarget,
} from "./controls";
import { QuestionEditor } from "./question-editor";

/** The end-of-section add, where a question with no card to attach to goes. */
function AddQuestion({ formId, sectionId }: { formId: string; sectionId: string }) {
  const { pending, run } = useAction();
  const [type, setType] = useState<string>(QUESTION_TYPES[0]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Type of question to add"
        className="w-56"
        value={type}
        disabled={pending}
        onChange={(event) => setType(event.target.value)}
      >
        {QUESTION_TYPES.map((value) => (
          <option key={value} value={value}>
            {QUESTION_TYPE_REGISTRY[value].label}
          </option>
        ))}
      </Select>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => addQuestion(formId, sectionId, type))}
      >
        Add question
      </Button>
    </div>
  );
}

export function SectionEditor({
  formId,
  section,
  index,
  count,
  targets,
  errors,
  answerCounts,
  focusedId,
  onFocus,
}: {
  formId: string;
  section: FormSection;
  index: number;
  count: number;
  targets: BranchTarget[];
  errors: GraphError[];
  answerCounts: Record<string, number>;
  focusedId: string | null;
  onFocus: (id: string | null) => void;
}) {
  const { pending, message, run } = useAction();
  const [title, setTitle] = useSynced(section.title);
  const [description, setDescription] = useSynced(section.description ?? "");

  const questions = [...section.questions].sort((a, b) => a.position - b.position);
  const sectionErrors = errors.filter((error) => error.questionId === null);
  const focused = focusedId === section.id;

  // Deleting a section takes its questions with it, so the confirmation counts
  // the answers to all of them rather than to any one.
  const answered = questions.reduce((total, question) => total + (answerCounts[question.id] ?? 0), 0);

  const saveText = () => {
    if (title === section.title && description === (section.description ?? "")) return;
    run(() => updateSection(formId, section.id, { title, description }));
  };

  return (
    <section className="flex flex-col gap-3">
      <div
        className={cn(
          "rounded-lg border border-t-4 border-t-primary/60 bg-card p-4 transition-shadow",
          focused ? "shadow-md" : "cursor-pointer hover:shadow-sm",
        )}
        onClick={(event) => {
          event.stopPropagation();
          onFocus(section.id);
        }}
      >
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Section {index + 1} of {count}
        </p>

        {focused ? (
          <div className="mt-2 flex flex-col gap-3">
            <InlineInput
              ariaLabel={`Section ${index + 1} title`}
              value={title}
              placeholder={`Section ${index + 1}`}
              disabled={pending}
              className="text-lg font-semibold"
              onChange={setTitle}
              onCommit={saveText}
            />

            <Textarea
              aria-label="Section description"
              rows={2}
              value={description}
              placeholder="Description"
              disabled={pending}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={saveText}
            />

            <BranchSelect
              id={`section-${section.id}-branch`}
              label="After this section"
              action={section.nextAction}
              targetId={section.nextSectionId}
              targets={targets}
              disabled={pending}
              onChange={(action, targetId) =>
                run(() => setSectionBranch(formId, section.id, action, targetId))
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="flex items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Move section up"
                  disabled={pending || index === 0}
                  onClick={() => run(() => moveSection(formId, section.id, -1))}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Move section down"
                  disabled={pending || index === count - 1}
                  onClick={() => run(() => moveSection(formId, section.id, 1))}
                >
                  ↓
                </Button>
              </div>

              <ConfirmDelete
                trigger="Delete section"
                heading={`Delete ${sectionLabel(section.title, section.position)}?`}
                confirmLabel={
                  answered === 0
                    ? "Delete this section"
                    : `Delete it and ${answerPhrase(answered)}`
                }
                disabled={pending}
                body={
                  <p>
                    {questions.length === 0
                      ? "This section has no questions."
                      : `Its ${questions.length} ${questions.length === 1 ? "question goes" : "questions go"} with it.`}{" "}
                    {answered === 0 ? (
                      "Nothing has been answered here, so no responses are lost."
                    ) : (
                      <span className="font-semibold">
                        {answerPhrase(answered)} across those questions will be deleted.
                      </span>
                    )}
                  </p>
                }
                onConfirm={() => run(() => deleteSection(formId, section.id, answered))}
              />
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-1">
            <p className="text-lg font-semibold">
              {sectionLabel(section.title, section.position)}
            </p>
            {section.description ? (
              <p className="text-sm text-muted-foreground">{section.description}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {questions.length} {questions.length === 1 ? "question" : "questions"}
            </p>
          </div>
        )}

        {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}
        {sectionErrors.map((error) => (
          <p key={error.message} className="mt-2 text-sm text-destructive">
            {error.message}
          </p>
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {questions.map((question, questionIndex) => (
          <QuestionEditor
            key={question.id}
            formId={formId}
            question={question}
            index={questionIndex}
            count={questions.length}
            targets={targets}
            errors={errors.filter((error) => error.questionId === question.id)}
            answerCount={answerCounts[question.id] ?? 0}
            focused={focusedId === question.id}
            onFocus={() => onFocus(question.id)}
          />
        ))}
      </ul>

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No questions in this section yet.</p>
      ) : null}

      <AddQuestion formId={formId} sectionId={section.id} />
    </section>
  );
}
