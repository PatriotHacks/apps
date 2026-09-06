"use client";

import {
  canBranch,
  hasGrid,
  hasOptions,
  type GraphError,
  type OptionKind,
  type Question,
  type QuestionOption,
} from "@patriothacks/form-engine";
import { Badge, Button, Checkbox, Input, Label } from "@patriothacks/ui";

import {
  addOption,
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
  Field,
  OrderControls,
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

function OptionRow({
  formId,
  option,
  index,
  count,
  branchable,
  targets,
  errors,
}: {
  formId: string;
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
    <li className="flex flex-col gap-2 rounded-md border p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <Field id={`option-${option.id}-label`} label={`${name} label`}>
            <Input
              id={`option-${option.id}-label`}
              value={label}
              disabled={pending}
              onChange={(event) => setLabel(event.target.value)}
              onBlur={() => {
                if (label !== option.label) run(() => updateOption(formId, option.id, label));
              }}
            />
          </Field>
        </div>

        {branchable ? (
          <div className="min-w-56 flex-1">
            <BranchSelect
              id={`option-${option.id}-branch`}
              label="When chosen"
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

        <OrderControls
          name={name}
          canMoveUp={index > 0}
          canMoveDown={index < count - 1}
          disabled={pending}
          onMoveUp={() => run(() => moveOption(formId, option.id, -1))}
          onMoveDown={() => run(() => moveOption(formId, option.id, 1))}
          onDelete={() => run(() => deleteOption(formId, option.id))}
        />
      </div>

      <p className="text-xs text-muted-foreground">Stored as {option.value}</p>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      {errors.map((error) => (
        <p key={error.message} className="text-sm text-destructive">
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
}: {
  formId: string;
  question: Question;
  kind: OptionKind;
  targets: BranchTarget[];
  errors: GraphError[];
}) {
  const { pending, run } = useAction();
  const options = question.options
    .filter((option) => option.kind === kind)
    .sort((a, b) => a.position - b.position);
  const branchable = kind === "choice" && canBranch(question.type);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{KIND_TITLES[kind]}</p>

      <ul className="flex flex-col gap-2">
        {options.map((option, index) => (
          <OptionRow
            key={option.id}
            formId={formId}
            option={option}
            index={index}
            count={options.length}
            branchable={branchable}
            targets={targets}
            errors={errors.filter((error) => error.optionId === option.id)}
          />
        ))}
      </ul>

      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => addOption(formId, question.id, kind))}
        >
          Add {KIND_NAMES[kind]}
        </Button>
      </div>
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
}: {
  formId: string;
  question: Question;
  index: number;
  count: number;
  targets: BranchTarget[];
  errors: GraphError[];
}) {
  const { pending, message, run } = useAction();
  const [label, setLabel] = useSynced(question.label);
  const [helpText, setHelpText] = useSynced(question.helpText ?? "");
  const name = `question ${index + 1}`;

  const save = (patch: { required?: boolean; editableAfterSubmit?: boolean } = {}) =>
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
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Field id={`question-${question.id}-label`} label="Question">
            <Input
              id={`question-${question.id}-label`}
              value={label}
              disabled={pending}
              onChange={(event) => setLabel(event.target.value)}
              onBlur={() => {
                if (label !== question.label) save();
              }}
            />
          </Field>
        </div>

        <Badge variant="outline">{question.type.replaceAll("_", " ")}</Badge>

        <OrderControls
          name={name}
          canMoveUp={index > 0}
          canMoveDown={index < count - 1}
          disabled={pending}
          onMoveUp={() => run(() => moveQuestion(formId, question.id, -1))}
          onMoveDown={() => run(() => moveQuestion(formId, question.id, 1))}
          onDelete={() => run(() => deleteQuestion(formId, question.id))}
        />
      </div>

      <Field id={`question-${question.id}-help`} label="Help text">
        <Input
          id={`question-${question.id}-help`}
          value={helpText}
          disabled={pending}
          onChange={(event) => setHelpText(event.target.value)}
          onBlur={() => {
            if (helpText !== (question.helpText ?? "")) save();
          }}
        />
      </Field>

      <div className="flex flex-wrap gap-6">
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

      <ConfigEditor formId={formId} question={question} />

      {hasOptions(question.type) ? (
        <OptionList
          formId={formId}
          question={question}
          kind="choice"
          targets={targets}
          errors={errors}
        />
      ) : null}

      {hasGrid(question.type) ? (
        <div className="grid gap-3 md:grid-cols-2">
          <OptionList
            formId={formId}
            question={question}
            kind="grid_row"
            targets={targets}
            errors={errors}
          />
          <OptionList
            formId={formId}
            question={question}
            kind="grid_column"
            targets={targets}
            errors={errors}
          />
        </div>
      ) : null}

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </li>
  );
}
