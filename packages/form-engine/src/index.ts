export {
  BRANCH_ACTIONS,
  OPTION_KINDS,
  QUESTION_TYPES,
  choiceOptions,
  gridColumns,
  gridRows,
  isQuestionType,
  type BranchAction,
  type FormDefinition,
  type FormSection,
  type OptionKind,
  type Question,
  type QuestionOption,
  type QuestionType,
} from "./types";

export {
  dateValueSchema,
  fileValueSchema,
  gridMultiValueSchema,
  gridSingleValueSchema,
  isCalendarDate,
  scaleValueSchema,
  textArrayValueSchema,
  textValueSchema,
  timeToSeconds,
  timeValueSchema,
  type FileAnswerValue,
} from "./value-schemas";

export {
  DEFAULT_ALLOWED_MIME_TYPES,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_SCALE_MAX,
  DEFAULT_SCALE_MIN,
  dateConfigSchema,
  emptyConfigSchema,
  fileUploadConfigSchema,
  linearScaleConfigSchema,
  textConfigSchema,
  timeConfigSchema,
  type DateConfig,
  type EmptyConfig,
  type FileUploadConfig,
  type LinearScaleConfig,
  type TextConfig,
  type TimeConfig,
} from "./config-schemas";

export {
  fileExtension,
  isEmptyAnswerValue,
  issue,
  mimeTypeForFileName,
  mimeTypeMatches,
  type AnswerIssue,
  type ValidationError,
  type ValidationErrorCode,
} from "./issues";

export type { ConstraintCheck, ConstraintContext } from "./constraints";

export {
  BRANCHABLE_QUESTION_TYPES,
  QUESTION_TYPE_REGISTRY,
  canBranch,
  getQuestionTypeDefinition,
  hasGrid,
  hasOptions,
  type AnswerValueByType,
  type QuestionConfigByType,
  type QuestionTypeDefinition,
  type QuestionTypeRegistry,
  type TypedAnswer,
  type TypedQuestionConfig,
} from "./registry";

export {
  parseAnswerValue,
  parseQuestionConfig,
  parseTypedAnswer,
  toSchemaIssues,
  typedAnswerSchema,
  type ParseResult,
  type SchemaIssue,
} from "./parse";

export {
  validateAnswer,
  validateAnswers,
  type AnswerSetValidationResult,
  type AnswerValidationResult,
} from "./validate";

export {
  branchingQuestions,
  firstSection,
  resolveNextSection,
  selectedOption,
  type AnswerMap,
  type NextSection,
} from "./traverse";

export { computeReachability, type Reachability } from "./reachability";

export {
  validateFormGraph,
  type GraphError,
  type GraphErrorCode,
  type GraphValidationResult,
} from "./validate-graph";

export { orphanedQuestionIds } from "./discard";
