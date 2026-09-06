import type {
  DateConfig,
  EmptyConfig,
  FileUploadConfig,
  LinearScaleConfig,
  TextConfig,
  TimeConfig,
} from "./config-schemas";
import {
  issue,
  mimeTypeForFileName,
  mimeTypeMatches,
  type AnswerIssue,
} from "./issues";
import { choiceOptions, gridColumns, gridRows, type Question } from "./types";
import { timeToSeconds, type FileAnswerValue } from "./value-schemas";

export interface ConstraintContext<TValue, TConfig> {
  question: Question;
  value: TValue;
  config: TConfig;
}

export type ConstraintCheck<TValue, TConfig> = (
  context: ConstraintContext<TValue, TConfig>,
) => AnswerIssue[];

export const checkTextConstraints: ConstraintCheck<string, TextConfig> = ({
  value,
  config,
}) => {
  const issues: AnswerIssue[] = [];
  if (config.minLength !== undefined && value.length < config.minLength) {
    issues.push(
      issue("too_short", `Must be at least ${config.minLength} characters`),
    );
  }
  if (config.maxLength !== undefined && value.length > config.maxLength) {
    issues.push(
      issue("too_long", `Must be at most ${config.maxLength} characters`),
    );
  }
  if (config.pattern !== undefined && !new RegExp(config.pattern).test(value)) {
    issues.push(issue("pattern_mismatch", "Does not match the expected format"));
  }
  return issues;
};

export const checkSingleChoice: ConstraintCheck<string, EmptyConfig> = ({
  question,
  value,
}) => {
  const allowed = new Set(choiceOptions(question).map((option) => option.value));
  return allowed.has(value)
    ? []
    : [issue("unknown_option", `"${value}" is not one of the options`)];
};

export const checkMultiChoice: ConstraintCheck<string[], EmptyConfig> = ({
  question,
  value,
}) => {
  const allowed = new Set(choiceOptions(question).map((option) => option.value));
  const issues: AnswerIssue[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (!allowed.has(entry)) {
      issues.push(
        issue("unknown_option", `"${entry}" is not one of the options`, [index]),
      );
    }
    if (seen.has(entry)) {
      issues.push(
        issue("duplicate_selection", `"${entry}" is selected twice`, [index]),
      );
    }
    seen.add(entry);
  });
  return issues;
};

export const checkScale: ConstraintCheck<number, LinearScaleConfig> = ({
  value,
  config,
}) => {
  if (value < config.min || value > config.max) {
    return [
      issue(
        "out_of_range",
        `Must be between ${config.min} and ${config.max}`,
      ),
    ];
  }
  return [];
};

export const checkDate: ConstraintCheck<string, DateConfig> = ({
  value,
  config,
}) => {
  const issues: AnswerIssue[] = [];
  if (config.min !== undefined && value < config.min) {
    issues.push(issue("out_of_range", `Must be on or after ${config.min}`));
  }
  if (config.max !== undefined && value > config.max) {
    issues.push(issue("out_of_range", `Must be on or before ${config.max}`));
  }
  return issues;
};

export const checkTime: ConstraintCheck<string, TimeConfig> = ({
  value,
  config,
}) => {
  const issues: AnswerIssue[] = [];
  const seconds = timeToSeconds(value);
  if (config.min !== undefined && seconds < timeToSeconds(config.min)) {
    issues.push(issue("out_of_range", `Must be at or after ${config.min}`));
  }
  if (config.max !== undefined && seconds > timeToSeconds(config.max)) {
    issues.push(issue("out_of_range", `Must be at or before ${config.max}`));
  }
  return issues;
};

export const checkGridSingle: ConstraintCheck<
  Record<string, string>,
  EmptyConfig
> = ({ question, value }) => {
  const rows = new Set(gridRows(question).map((row) => row.id));
  const columns = new Set(gridColumns(question).map((column) => column.id));
  const issues: AnswerIssue[] = [];
  for (const [rowId, columnId] of Object.entries(value)) {
    if (!rows.has(rowId)) {
      issues.push(
        issue("unknown_grid_row", `"${rowId}" is not a row of this grid`, [
          rowId,
        ]),
      );
      continue;
    }
    if (!columns.has(columnId)) {
      issues.push(
        issue(
          "unknown_grid_column",
          `"${columnId}" is not a column of this grid`,
          [rowId],
        ),
      );
    }
  }
  return issues;
};

export const checkGridMulti: ConstraintCheck<
  Record<string, string[]>,
  EmptyConfig
> = ({ question, value }) => {
  const rows = new Set(gridRows(question).map((row) => row.id));
  const columns = new Set(gridColumns(question).map((column) => column.id));
  const issues: AnswerIssue[] = [];
  for (const [rowId, columnIds] of Object.entries(value)) {
    if (!rows.has(rowId)) {
      issues.push(
        issue("unknown_grid_row", `"${rowId}" is not a row of this grid`, [
          rowId,
        ]),
      );
      continue;
    }
    const seen = new Set<string>();
    columnIds.forEach((columnId, index) => {
      if (!columns.has(columnId)) {
        issues.push(
          issue(
            "unknown_grid_column",
            `"${columnId}" is not a column of this grid`,
            [rowId, index],
          ),
        );
      }
      if (seen.has(columnId)) {
        issues.push(
          issue(
            "duplicate_selection",
            `"${columnId}" is selected twice in this row`,
            [rowId, index],
          ),
        );
      }
      seen.add(columnId);
    });
  }
  return issues;
};

export const checkFile: ConstraintCheck<
  FileAnswerValue,
  FileUploadConfig
> = ({ value, config }) => {
  const issues: AnswerIssue[] = [];
  if (value.size > config.maxBytes) {
    issues.push(
      issue("file_too_large", `Must be ${config.maxBytes} bytes or smaller`, [
        "size",
      ]),
    );
  }
  const mimeType = mimeTypeForFileName(value.name);
  const allowed =
    mimeType !== null &&
    config.allowedMimeTypes.some((pattern) =>
      mimeTypeMatches(mimeType, pattern),
    );
  if (!allowed) {
    issues.push(
      issue(
        "file_type_not_allowed",
        `Allowed file types: ${config.allowedMimeTypes.join(", ")}`,
        ["name"],
      ),
    );
  }
  return issues;
};
