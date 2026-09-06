"use client";

import {
  QUESTION_TYPES,
  QUESTION_TYPE_REGISTRY,
  type FormSection,
  type GraphError,
} from "@patriothacks/form-engine";
import { Button, Input, Textarea } from "@patriothacks/ui";
import { useState } from "react";

import { addQuestion, deleteSection, moveSection, setSectionBranch, updateSection } from "./actions";
import {
  BranchSelect,
  Field,
  OrderControls,
  SELECT_CLASS,
  useAction,
  useSynced,
  type BranchTarget,
} from "./controls";
import { QuestionEditor } from "./question-editor";

function AddQuestion({ formId, sectionId }: { formId: string; sectionId: string }) {
  const { pending, run } = useAction();
  const [type, setType] = useState<string>(QUESTION_TYPES[0]);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1">
        <Field id={`add-question-${sectionId}`} label="Question type">
          <select
            id={`add-question-${sectionId}`}
            className={SELECT_CLASS}
            value={type}
            disabled={pending}
            onChange={(event) => setType(event.target.value)}
          >
            {QUESTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {QUESTION_TYPE_REGISTRY[value].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Button
        type="button"
        size="sm"
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
}: {
  formId: string;
  section: FormSection;
  index: number;
  count: number;
  targets: BranchTarget[];
  errors: GraphError[];
}) {
  const { pending, message, run } = useAction();
  const [title, setTitle] = useSynced(section.title);
  const [description, setDescription] = useSynced(section.description ?? "");
  const name = `section ${index + 1}`;

  const questions = [...section.questions].sort((a, b) => a.position - b.position);
  const sectionErrors = errors.filter((error) => error.questionId === null);

  const saveText = () => {
    if (title === section.title && description === (section.description ?? "")) return;
    run(() => updateSection(formId, section.id, { title, description }));
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-56 flex-1">
          <Field id={`section-${section.id}-title`} label={`Section ${index + 1} title`}>
            <Input
              id={`section-${section.id}-title`}
              value={title}
              disabled={pending}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveText}
            />
          </Field>
        </div>

        <OrderControls
          name={name}
          canMoveUp={index > 0}
          canMoveDown={index < count - 1}
          disabled={pending}
          onMoveUp={() => run(() => moveSection(formId, section.id, -1))}
          onMoveDown={() => run(() => moveSection(formId, section.id, 1))}
          onDelete={() => run(() => deleteSection(formId, section.id))}
        />
      </div>

      <Field id={`section-${section.id}-description`} label="Description">
        <Textarea
          id={`section-${section.id}-description`}
          rows={2}
          value={description}
          disabled={pending}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={saveText}
        />
      </Field>

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

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      {sectionErrors.map((error) => (
        <p key={error.message} className="text-sm text-destructive">
          {error.message}
        </p>
      ))}

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
          />
        ))}
      </ul>

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No questions yet.</p>
      ) : null}

      <AddQuestion formId={formId} sectionId={section.id} />
    </section>
  );
}
