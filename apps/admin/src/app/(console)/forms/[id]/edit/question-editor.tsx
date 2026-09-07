"use client";

import {
  QUESTION_TYPES,
  QUESTION_TYPE_REGISTRY,
  canBranch,
  hasGrid,
  hasOptions,
  type GraphError,
  type OptionKind,
  type Question,
  type QuestionOption,
  type QuestionType,
} from "@patriothacks/form-engine";
import { Button, Checkbox, Label, cn } from "@patriothacks/ui";

import {
  addOption,
  addQuestion,
  changeQuestionType,
  deleteOption,
  deleteQuestion,
  moveOption,
  moveQuestion,
  setOptionBranch,
  updateOption,
  updateQuestion,
} from "./actions";
import { ConfigEditor } from "./config-editor";
import {
  BranchSelect,
  ConfirmDelete,
  InlineInput,
  SELECT_CLASS,
  answerPhrase,
  useAction,
  useSynced,
  type BranchTarget,
} from "./controls";

const KIND_TITLES: Record<OptionKind, string> = {
  choice: "Options",
  grid_row: "Rows",
  grid_column: "Columns",
};

const KIND_NAMES: Record<OptionKind, string> = {
  choice: "option",
  grid_row: "row",
  grid_column: "column",
};

/**
 * The mark beside an option, matching the control the applicant will actually
 * get. A checkbox question whose options are drawn as radios teaches the builder
 * the wrong thing about the form they are building.
 */
function optionGlyph(type: QuestionType, kind: OptionKind, index: number): string {
  if (kind === "grid_column") return "|";
  if (kind === "grid_row") return "—";
  if (type === "checkboxes") return "☐";
  if (type === "dropdown") return `${index + 1}.`;
  return "○";
}

/**
 * One option, edited where it sits. The label is the only thing normally
 * touched, so it is the only thing always visible; the branch target appears
 * beside it when the type can branch, and the remove button on the row itself
 * rather than behind a menu.
 */
function OptionRow({
  formId,
  question,
  option,
  index,
  count,
  branchable,
  targets,
  errors,
}: {
  formId: string;
  question: Question;
  option: QuestionOption;
  index: number;
  count: number;
  branchable: boolean;
  targets: BranchTarget[];
  errors: GraphError[];
}) {
  const { pending, message, run } = useAction();
  const [label, setLabel] = useSynced(option.label);
  const name = `${KIND_NAMES[option.kind]} ${index + 1}`;

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span aria-hidden className="w-5 shrink-0 text-center text-sm text-muted-foreground">
          {optionGlyph(question.type, option.kind, index)}
        </span>

        <InlineInput
          ariaLabel={`${name} label`}
          value={label}
          disabled={pending}
          className="flex-1 text-sm"
          onChange={setLabel}
          onCommit={() => {
            if (label !== option.label) run(() => updateOption(formId, option.id, label));
          }}
        />

        {branchable ? (
          <div className="w-56 shrink-0">
            <BranchSelect
              id={`option-${option.id}-branch`}
              label=""
              action={option.nextAction}
              targetId={option.nextSectionId}
              targets={targets}
              disabled={pending}
              onChange={(action, targetId) =>
                run(() => setOptionBranch(formId, option.id, action, targetId))
              }
            />
          </div>
        ) : null}

        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Move ${name} up`}
            disabled={pending || index === 0}
            onClick={() => run(() => moveOption(formId, option.id, -1))}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Move ${name} down`}
            disabled={pending || index === count - 1}
            onClick={() => run(() => moveOption(formId, option.id, 1))}
          >
            ↓
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Remove ${name}`}
            className="text-muted-foreground hover:text-destructive"
            disabled={pending}
            onClick={() => run(() => deleteOption(formId, option.id))}
          >
            ✕
          </Button>
        </div>
      </div>

      {message ? <p className="pl-7 text-sm text-destructive">{message}</p> : null}
      {errors.map((error) => (
        <p key={error.message} className="pl-7 text-sm text-destructive">
          {error.message}
        </p>
      ))}
    </li>
  );
}

function OptionList({
  formId,
  question,
  kind,
  targets,
  errors,
  heading,
}: {
  formId: string;
  question: Question;
  kind: OptionKind;
  targets: BranchTarget[];
  errors: GraphError[];
  heading: boolean;
}) {
  const { pending, run } = useAction();
  const options = question.options
    .filter((option) => option.kind === kind)
    .sort((a, b) => a.position - b.position);
  const branchable = kind === "choice" && canBranch(question.type);

  return (
    <div className="flex flex-col gap-1">
      {heading ? (
        <p className="text-xs font-medium text-muted-foreground">{KIND_TITLES[kind]}</p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {options.map((option, index) => (
          <OptionRow
            key={option.id}
            formId={formId}
            question={question}
            option={option}
            index={index}
            count={options.length}
            branchable={branchable}
            targets={targets}
            errors={errors.filter((error) => error.optionId === option.id)}
          />
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <span aria-hidden className="w-5 shrink-0 text-center text-sm text-muted-foreground">
          {optionGlyph(question.type, kind, options.length)}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="px-2 text-muted-foreground"
          disabled={pending}
          onClick={() => run(() => addOption(formId, question.id, kind))}
        >
          Add {KIND_NAMES[kind]}
        </Button>
      </div>
    </div>
  );
}

/** What the card shows when it is not the one being edited. */
function Resting({ question, answerCount }: { question: Question; answerCount: number }) {
  const options = question.options
    .filter((option) => option.kind === "choice" || option.kind === "grid_row")
    .sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-base font-medium">
          {question.label}
          {question.required ? <span className="text-destructive"> *</span> : null}
        </p>
        <span className="text-xs text-muted-foreground">
          {QUESTION_TYPE_REGISTRY[question.type].label}
        </span>
        {answerCount > 0 ? (
          <span className="text-xs text-muted-foreground">· {answerPhrase(answerCount)}</span>
        ) : null}
      </div>

      {question.helpText ? (
        <p className="text-sm text-muted-foreground">{question.helpText}</p>
      ) : null}

      {options.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          {options.slice(0, 4).map((option, index) => (
            <li key={option.id}>
              <span aria-hidden className="mr-2">
                {optionGlyph(question.type, option.kind, index)}
              </span>
              {option.label}
            </li>
          ))}
          {options.length > 4 ? (
            <li className="text-xs">and {options.length - 4} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export function QuestionEditor({
  formId,
  question,
  index,
  count,
  targets,
  errors,
  answerCount,
  focused,
  onFocus,
}: {
  formId: string;
  question: Question;
  index: number;
  count: number;
  targets: BranchTarget[];
  errors: GraphError[];
  answerCount: number;
  focused: boolean;
  onFocus: () => void;
}) {
  const { pending, message, run } = useAction();
  const [label, setLabel] = useSynced(question.label);
  const [helpText, setHelpText] = useSynced(question.helpText ?? "");

  const save = (patch: { label?: string; required?: boolean; editableAfterSubmit?: boolean } = {}) =>
    run(() =>
      updateQuestion(formId, question.id, {
        label,
        helpText,
        required: question.required,
        editableAfterSubmit: question.editableAfterSubmit,
        ...patch,
      }),
    );

  return (
    <li
      className={cn(
        "relative rounded-lg border bg-card p-4 transition-shadow",
        focused ? "border-l-4 border-l-primary shadow-md" : "cursor-pointer hover:shadow-sm",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onFocus();
      }}
    >
      {focused ? <AddBelow formId={formId} question={question} /> : null}

      {!focused ? (
        <Resting question={question} answerCount={answerCount} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-56 flex-1">
              <InlineInput
                ariaLabel="Question"
                value={label}
                placeholder="Question"
                disabled={pending}
                className="text-base font-medium"
                onChange={setLabel}
                onCommit={() => {
                  if (label !== question.label) save();
                }}
              />
            </div>

            <select
              aria-label="Question type"
              className={cn(SELECT_CLASS, "w-56 shrink-0")}
              value={question.type}
              disabled={pending}
              onChange={(event) => run(() => changeQuestionType(formId, question.id, event.target.value))}
            >
              {QUESTION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {QUESTION_TYPE_REGISTRY[value].label}
                </option>
              ))}
            </select>
          </div>

          <InlineInput
            ariaLabel="Help text"
            value={helpText}
            placeholder="Help text"
            disabled={pending}
            className="text-sm text-muted-foreground"
            onChange={setHelpText}
            onCommit={() => {
              if (helpText !== (question.helpText ?? "")) save();
            }}
          />

          {hasOptions(question.type) ? (
            <OptionList
              formId={formId}
              question={question}
              kind="choice"
              targets={targets}
              errors={errors}
              heading={false}
            />
          ) : null}

          {hasGrid(question.type) ? (
            <div className="grid gap-4 md:grid-cols-2">
              <OptionList
                formId={formId}
                question={question}
                kind="grid_row"
                targets={targets}
                errors={errors}
                heading
              />
              <OptionList
                formId={formId}
                question={question}
                kind="grid_column"
                targets={targets}
                errors={errors}
                heading
              />
            </div>
          ) : null}

          <ConfigEditor formId={formId} question={question} />

          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          {errors
            .filter((error) => error.optionId === null)
            .map((error) => (
              <p key={error.message} className="text-sm text-destructive">
                {error.message}
              </p>
            ))}

          <div className="flex flex-wrap items-center justify-end gap-4 border-t pt-3">
            <div className="mr-auto flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`question-${question.id}-required`}
                  checked={question.required}
                  disabled={pending}
                  onCheckedChange={(checked) => save({ required: checked === true })}
                />
                <Label htmlFor={`question-${question.id}-required`} className="font-normal">
                  Required
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`question-${question.id}-editable`}
                  checked={question.editableAfterSubmit}
                  disabled={pending}
                  onCheckedChange={(checked) => save({ editableAfterSubmit: checked === true })}
                />
                <Label htmlFor={`question-${question.id}-editable`} className="font-normal">
                  Editable after submit
                </Label>
              </div>
            </div>

            <div className="flex items-center">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Move question up"
                disabled={pending || index === 0}
                onClick={() => run(() => moveQuestion(formId, question.id, -1))}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Move question down"
                disabled={pending || index === count - 1}
                onClick={() => run(() => moveQuestion(formId, question.id, 1))}
              >
                ↓
              </Button>
            </div>
          </div>

          <ConfirmDelete
            trigger="Delete question"
            heading={`Delete "${question.label}"?`}
            confirmLabel={
              answerCount === 0 ? "Delete this question" : `Delete it and ${answerPhrase(answerCount)}`
            }
            disabled={pending}
            body={
              answerCount === 0 ? (
                <p>No one has answered this question yet, so nothing is lost with it.</p>
              ) : (
                <p>
                  <span className="font-semibold">
                    {answerPhrase(answerCount)} to this question will be deleted with it.
                  </span>{" "}
                  Those responses stop appearing in the console and in every export. They are kept in
                  the revision history for audit only, and re-adding the question does not bring them
                  back.
                </p>
              )
            }
            onConfirm={() => run(() => deleteQuestion(formId, question.id, answerCount))}
          />
        </div>
      )}
    </li>
  );
}

/**
 * The add button belongs to the card you are on, so a question lands under the
 * one you were just looking at. The floating rail is the shape people know from
 * Google Forms; below `lg` there is no room beside the card and it becomes an
 * ordinary button under it instead.
 */
function AddBelow({ formId, question }: { formId: string; question: Question }) {
  const { pending, run } = useAction();
  const add = () => run(() => addQuestion(formId, question.sectionId, question.type, question.id));

  return (
    <>
      <div className="absolute top-2 left-full ml-2 hidden lg:block">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Add question below"
          title="Add question below"
          disabled={pending}
          onClick={add}
        >
          +
        </Button>
      </div>

      <div className="mb-3 lg:hidden">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={add}>
          Add question below
        </Button>
      </div>
    </>
  );
}
