import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type {
  admins,
  answerRevisions,
  answers,
  broadcasts,
  emailSends,
  emailTemplates,
  emailUnsubscribes,
  formSections,
  forms,
  profiles,
  questionOptions,
  questions,
  submissionReviews,
  submissions,
} from "./schema/index.ts";

export type Profile = InferSelectModel<typeof profiles>;
export type NewProfile = InferInsertModel<typeof profiles>;

export type Admin = InferSelectModel<typeof admins>;
export type NewAdmin = InferInsertModel<typeof admins>;

export type Form = InferSelectModel<typeof forms>;
export type NewForm = InferInsertModel<typeof forms>;

export type FormSection = InferSelectModel<typeof formSections>;
export type NewFormSection = InferInsertModel<typeof formSections>;

export type Question = InferSelectModel<typeof questions>;
export type NewQuestion = InferInsertModel<typeof questions>;

export type QuestionOption = InferSelectModel<typeof questionOptions>;
export type NewQuestionOption = InferInsertModel<typeof questionOptions>;

export type Submission = InferSelectModel<typeof submissions>;
export type NewSubmission = InferInsertModel<typeof submissions>;

export type Answer = InferSelectModel<typeof answers>;
export type NewAnswer = InferInsertModel<typeof answers>;

export type AnswerRevision = InferSelectModel<typeof answerRevisions>;
export type NewAnswerRevision = InferInsertModel<typeof answerRevisions>;

export type SubmissionReview = InferSelectModel<typeof submissionReviews>;
export type NewSubmissionReview = InferInsertModel<typeof submissionReviews>;

export type EmailTemplate = InferSelectModel<typeof emailTemplates>;
export type NewEmailTemplate = InferInsertModel<typeof emailTemplates>;

export type Broadcast = InferSelectModel<typeof broadcasts>;
export type NewBroadcast = InferInsertModel<typeof broadcasts>;

export type EmailSend = InferSelectModel<typeof emailSends>;
export type NewEmailSend = InferInsertModel<typeof emailSends>;

export type EmailUnsubscribe = InferSelectModel<typeof emailUnsubscribes>;
export type NewEmailUnsubscribe = InferInsertModel<typeof emailUnsubscribes>;
