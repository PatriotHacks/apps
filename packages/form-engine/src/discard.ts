import { isEmptyAnswerValue } from "./issues";
import { computeReachability } from "./reachability";
import type { AnswerMap } from "./traverse";
import type { FormDefinition } from "./types";

/**
 * Which stored answers a change in answers orphans.
 *
 * An answer is orphaned when its question was reachable under the previous
 * answers and is not reachable under the new ones — the applicant switched
 * branches and a page of typing is now on a path they are no longer on.
 *
 * Questions that hold nothing are left out: there is no answer row to delete
 * and no revision worth writing, so the caller's delete list stays exactly the
 * work it has to do.
 *
 * This function decides *what* is orphaned and nothing more. The delete and the
 * `answer_revisions` rows that make it recoverable belong to the caller, in the
 * same transaction as the triggering update. This package has no database
 * access by design.
 */
export function orphanedQuestionIds(
  form: FormDefinition,
  previousAnswers: AnswerMap,
  nextAnswers: AnswerMap,
): string[] {
  const before = computeReachability(form, previousAnswers);
  const after = computeReachability(form, nextAnswers);

  return before.questions
    .filter(
      (question) =>
        !after.questionIds.has(question.id) &&
        !isEmptyAnswerValue(previousAnswers[question.id]),
    )
    .map((question) => question.id);
}
