import { canBranch } from "./registry";
import {
  choiceOptions,
  type FormDefinition,
  type FormSection,
  type Question,
  type QuestionOption,
} from "./types";

/**
 * Section-to-section traversal.
 *
 * A form is a directed graph of sections. Given a set of answers, exactly one
 * section follows any given section, resolved in this order:
 *
 * 1. A branching question in the section whose selected option carries a
 *    `nextAction` of its own — jump to that option's `nextSectionId`, or end
 *    the form if the option submits.
 * 2. The section's own `nextAction`.
 * 3. The next section by `position`.
 *
 * Nothing here reads the database and nothing throws. A malformed graph
 * degrades to positional order rather than failing; `validateFormGraph` is what
 * refuses to publish one.
 */

/** Raw answer values keyed by question id, as `validateAnswers` takes them. */
export type AnswerMap = Record<string, unknown>;

/**
 * What follows a section. `submit` covers both an explicit
 * `nextAction: 'submit'` and running off the end of the form.
 */
export type NextSection =
  | { kind: "section"; sectionId: string }
  | { kind: "submit" };

/** Sections in position order plus the lookups traversal needs. */
export interface SectionGraph {
  ordered: FormSection[];
  byId: Map<string, FormSection>;
  indexById: Map<string, number>;
}

/** Position, then id, so ordering is total even if positions collide. */
export function byPosition<T extends { id: string; position: number }>(
  a: T,
  b: T,
): number {
  if (a.position !== b.position) return a.position - b.position;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function buildSectionGraph(form: FormDefinition): SectionGraph {
  const ordered = [...form.sections].sort(byPosition);
  const byId = new Map<string, FormSection>();
  const indexById = new Map<string, number>();
  ordered.forEach((section, index) => {
    byId.set(section.id, section);
    indexById.set(section.id, index);
  });
  return { ordered, byId, indexById };
}

/** The first section by position — where every traversal starts. */
export function firstSection(form: FormDefinition): FormSection | null {
  return buildSectionGraph(form).ordered[0] ?? null;
}

/** Questions that may carry per-option branching, in position order. */
export function branchingQuestions(section: FormSection): Question[] {
  return section.questions
    .filter((question) => canBranch(question.type))
    .sort(byPosition);
}

/**
 * The option a single-select answer picked, or null.
 *
 * `answers.value` for `multiple_choice` and `dropdown` is the option's `value`
 * string, so an unanswered question, a non-string blob, or a value that matches
 * no option all count as "no selection".
 */
export function selectedOption(
  question: Question,
  value: unknown,
): QuestionOption | null {
  if (typeof value !== "string") return null;
  return (
    choiceOptions(question).find((option) => option.value === value) ?? null
  );
}

/**
 * The outcome a section's answers branch to, if any.
 *
 * A selected option ends the form when its `nextAction` is `submit` and jumps
 * when it is `section` with a target that exists — "pick this answer and you
 * are done" is a real form pattern, and `question_options.next_action` carries
 * the full `branch_action` enum, so the builder can express it.
 *
 * A section is not supposed to hold more than one branching question, but the
 * schema permits it, so the rule is explicit: the earliest branching question
 * by position that resolves a usable outcome wins. A branching question that is
 * unanswered, or whose selected option resolves nothing, is skipped rather than
 * ending the search — so a later question can still supply the outcome.
 */
function branchOutcome(
  graph: SectionGraph,
  section: FormSection,
  answers: AnswerMap,
): NextSection | null {
  for (const question of branchingQuestions(section)) {
    const option = selectedOption(question, answers[question.id]);
    if (option === null) continue;
    if (option.nextAction === "submit") return { kind: "submit" };
    if (option.nextAction !== "section") continue;
    const target = option.nextSectionId;
    if (target !== null && graph.byId.has(target)) {
      return { kind: "section", sectionId: target };
    }
  }
  return null;
}

/** Resolve the successor of a section already located in `graph`. */
export function nextSectionFrom(
  graph: SectionGraph,
  section: FormSection,
  answers: AnswerMap,
): NextSection {
  const branch = branchOutcome(graph, section, answers);
  if (branch !== null) return branch;

  if (section.nextAction === "submit") return { kind: "submit" };
  if (section.nextAction === "section") {
    const target = section.nextSectionId;
    if (target !== null && graph.byId.has(target)) {
      return { kind: "section", sectionId: target };
    }
  }

  const index = graph.indexById.get(section.id);
  const following = index === undefined ? undefined : graph.ordered[index + 1];
  return following === undefined
    ? { kind: "submit" }
    : { kind: "section", sectionId: following.id };
}

/**
 * Resolve what follows `sectionId` under the given answers. A section id that
 * is not part of the form has nothing after it, so it resolves to submit.
 */
export function resolveNextSection(
  form: FormDefinition,
  sectionId: string,
  answers: AnswerMap,
): NextSection {
  const graph = buildSectionGraph(form);
  const section = graph.byId.get(sectionId);
  if (section === undefined) return { kind: "submit" };
  return nextSectionFrom(graph, section, answers);
}
