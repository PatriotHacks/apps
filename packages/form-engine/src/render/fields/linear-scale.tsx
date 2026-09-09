"use client";

import { Label, RadioGroup, RadioGroupItem } from "@patriothacks/ui";
import { parseQuestionConfig } from "../../parse";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
  fieldLabelId,
} from "../field-shell";

export function LinearScaleField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"linear_scale">) {
  const controlId = fieldControlId(question.id);
  const config = parseQuestionConfig("linear_scale", question.config);

  // A scale with no readable range has nothing to render. `validateAnswer`
  // reports the same blob as `invalid_config`, so the builder still hears it.
  if (!config.success) {
    return <FieldShell question={question} error={error} />;
  }

  const { min, max, minLabel, maxLabel } = config.data;
  const points = Array.from({ length: max - min + 1 }, (_, step) => min + step);

  return (
    <FieldShell question={question} error={error}>
      <div className="flex flex-col gap-2">
        <RadioGroup
          className="flex justify-between gap-1 sm:justify-start sm:gap-4"
          value={value === null ? "" : String(value)}
          disabled={disabled}
          aria-labelledby={fieldLabelId(question.id)}
          aria-describedby={fieldDescribedBy(question, error)}
          aria-required={question.required}
          aria-invalid={error ? true : undefined}
          onValueChange={(next) => onChange(Number(next))}
        >
          {points.map((point) => {
            const pointId = `${controlId}-${point}`;
            return (
              <div key={point} className="flex flex-col items-center gap-1">
                <RadioGroupItem id={pointId} value={String(point)} />
                <Label htmlFor={pointId} className="font-normal">
                  {point}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
        {minLabel || maxLabel ? (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}
