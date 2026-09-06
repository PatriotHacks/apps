"use client";

import { parseQuestionConfig, type Question, type QuestionType } from "@patriothacks/form-engine";
import { Input } from "@patriothacks/ui";
import { useState } from "react";

import { updateQuestionConfig } from "./actions";
import { Field, useAction } from "./controls";

type ConfigFieldKind = "number" | "text" | "date" | "time" | "list";

interface ConfigFieldSpec {
  name: string;
  label: string;
  kind: ConfigFieldKind;
}

const TEXT_FIELDS: ConfigFieldSpec[] = [
  { name: "minLength", label: "Minimum length", kind: "number" },
  { name: "maxLength", label: "Maximum length", kind: "number" },
  { name: "pattern", label: "Pattern (regular expression)", kind: "text" },
];

/**
 * One row per entry in the type's config schema. Types whose schema is
 * `emptyConfigSchema` have nothing to settle here — their shape comes from
 * their options instead.
 */
const CONFIG_FIELDS: Record<QuestionType, ConfigFieldSpec[]> = {
  short_answer: TEXT_FIELDS,
  paragraph: TEXT_FIELDS,
  multiple_choice: [],
  checkboxes: [],
  dropdown: [],
  linear_scale: [
    { name: "min", label: "Lowest point", kind: "number" },
    { name: "max", label: "Highest point", kind: "number" },
    { name: "minLabel", label: "Label for the lowest point", kind: "text" },
    { name: "maxLabel", label: "Label for the highest point", kind: "text" },
  ],
  date: [
    { name: "min", label: "Earliest date", kind: "date" },
    { name: "max", label: "Latest date", kind: "date" },
  ],
  time: [
    { name: "min", label: "Earliest time", kind: "time" },
    { name: "max", label: "Latest time", kind: "time" },
  ],
  grid_multiple_choice: [],
  grid_checkbox: [],
  file_upload: [
    { name: "allowedMimeTypes", label: "Allowed MIME types (comma separated)", kind: "list" },
    { name: "maxBytes", label: "Maximum size in bytes", kind: "number" },
  ],
};

const INPUT_TYPES: Record<ConfigFieldKind, string> = {
  number: "number",
  text: "text",
  date: "date",
  time: "time",
  list: "text",
};

function toText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/**
 * Turns the text inputs back into the shape the type's schema expects. An empty
 * field is left out entirely so the schema's own default applies rather than a
 * value invented here; anything that is not a number is sent as typed so the
 * schema reports it rather than the field silently swallowing it.
 */
function toRaw(specs: ConfigFieldSpec[], values: Record<string, string>): Record<string, unknown> {
  const raw: Record<string, unknown> = {};

  for (const spec of specs) {
    const text = (values[spec.name] ?? "").trim();
    if (text.length === 0) continue;

    if (spec.kind === "number") {
      const parsed = Number(text);
      raw[spec.name] = Number.isFinite(parsed) ? parsed : text;
      continue;
    }
    if (spec.kind === "list") {
      raw[spec.name] = text
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      continue;
    }
    raw[spec.name] = text;
  }

  return raw;
}

export function ConfigEditor({ formId, question }: { formId: string; question: Question }) {
  const specs = CONFIG_FIELDS[question.type];
  const parsed = parseQuestionConfig(question.type, question.config);
  const stored = parsed.success ? (parsed.data as Record<string, unknown>) : {};

  const { pending, message, run } = useAction();
  const incoming = Object.fromEntries(
    specs.map((spec) => [spec.name, toText(stored[spec.name])]),
  );

  // The schema materialises its defaults on save, so the stored config can come
  // back holding more than was typed. Follow it rather than keep the fields as
  // they were left.
  const signature = JSON.stringify(incoming);
  const [seen, setSeen] = useState(signature);
  const [values, setValues] = useState<Record<string, string>>(incoming);
  if (signature !== seen) {
    setSeen(signature);
    setValues(incoming);
  }

  if (specs.length === 0) return null;

  const save = () => run(() => updateQuestionConfig(formId, question.id, toRaw(specs, values)));

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed p-3">
      <p className="text-xs font-medium text-muted-foreground">Settings</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {specs.map((spec) => {
          const id = `config-${question.id}-${spec.name}`;
          return (
            <Field key={spec.name} id={id} label={spec.label}>
              <Input
                id={id}
                type={INPUT_TYPES[spec.kind]}
                value={values[spec.name] ?? ""}
                disabled={pending}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [spec.name]: event.target.value }))
                }
                onBlur={save}
              />
            </Field>
          );
        })}
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      {!parsed.success ? (
        <p className="text-sm text-destructive">
          The stored settings do not match this question type and applicants will see no control.
        </p>
      ) : null}
    </div>
  );
}
