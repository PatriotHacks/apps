import type { ConstraintCheck } from "./constraints";
import { isEmptyAnswerValue, type ValidationError } from "./issues";
import { parseAnswerValue, parseQuestionConfig } from "./parse";
import { QUESTION_TYPE_REGISTRY, type TypedAnswer } from "./registry";
import type { Question } from "./types";

export type AnswerValidationResult =
  | { success: true; questionId: string; answer: TypedAnswer | null }
  | { success: false; questionId: string; errors: ValidationError[] };

export interface AnswerSetValidationResult {
  success: boolean;
  errors: ValidationError[];
  /** Parsed answers by question id. `null` means the question was left blank. */
  answers: Record<string, TypedAnswer | null>;
}

/**
 * Validate one candidate answer. Runs in four stages, stopping at the first
 * that fails: config, emptiness, shape, then type-specific constraints.
 */
export function validateAnswer(
  question: Question,
  value: unknown,
): AnswerValidationResult {
  const { id: questionId, type } = question;
  const definition = QUESTION_TYPE_REGISTRY[type];

  const config = parseQuestionConfig(type, question.config);
  if (!config.success) {
    return {
      success: false,
      questionId,
      errors: config.issues.map((problem) => ({
        questionId,
        code: "invalid_config" as const,
        message: `Question is misconfigured: ${problem.message}`,
        path: problem.path,
      })),
    };
  }

  if (isEmptyAnswerValue(value)) {
    if (question.required) {
      return {
        success: false,
        questionId,
        errors: [
          {
            questionId,
            code: "required",
            message: "This question requires an answer",
            path: [],
          },
        ],
      };
    }
    return { success: true, questionId, answer: null };
  }

  const parsed = parseAnswerValue(type, value);
  if (!parsed.success) {
    return {
      success: false,
      questionId,
      errors: parsed.issues.map((problem) => ({
        questionId,
        code: "invalid_value" as const,
        message: problem.message,
        path: problem.path,
      })),
    };
  }

  // The registry correlates each entry's value, config and check, but that
  // correlation is not resolvable through a union-typed `question.type`.
  const check = definition.checkConstraints as ConstraintCheck<
    unknown,
    unknown
  >;
  const issues = check({ question, value: parsed.data, config: config.data });
  if (issues.length > 0) {
    return {
      success: false,
      questionId,
      errors: issues.map((problem) => ({ questionId, ...problem })),
    };
  }

  return {
    success: true,
    questionId,
    answer: { type, value: parsed.data } as TypedAnswer,
  };
}

/**
 * Validate a set of answers keyed by question id. Callers pass only the
 * reachable questions; reachability is the traversal engine's job, not this
 * function's.
 */
export function validateAnswers(
  questions: Question[],
  values: Record<string, unknown>,
): AnswerSetValidationResult {
  const errors: ValidationError[] = [];
  const answers: Record<string, TypedAnswer | null> = {};

  for (const question of questions) {
    const result = validateAnswer(question, values[question.id]);
    if (result.success) {
      answers[question.id] = result.answer;
    } else {
      errors.push(...result.errors);
    }
  }

  return { success: errors.length === 0, errors, answers };
}
