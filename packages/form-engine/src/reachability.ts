import {
  buildSectionGraph,
  byPosition,
  nextSectionFrom,
  type AnswerMap,
} from "./traverse";
import type { FormDefinition, FormSection, Question } from "./types";

/**
 * Which sections and questions a given set of answers actually reaches.
 *
 * Three things depend on this and must agree: required-field validation runs
 * only over reachable questions, the CSV export uses it to tell "never asked"
 * from "asked but left blank", and branch discard uses it to decide what to
 * delete. It is computed by walking the graph from the first section, so it
 * always describes one path — the path this applicant is on.
 */
export interface Reachability {
  /** Sections in the order traversal visits them. */
  sections: FormSection[];
  /** Their questions, in section order then question position. */
  questions: Question[];
  sectionIds: Set<string>;
  questionIds: Set<string>;
}

/**
 * Walk the form from its first section under the given answers.
 *
 * Terminates on any input: a section is visited at most once, so a cycle that
 * publish-time validation should have refused stops at the repeat rather than
 * spinning.
 */
export function computeReachability(
  form: FormDefinition,
  answers: AnswerMap,
): Reachability {
  const graph = buildSectionGraph(form);
  const sections: FormSection[] = [];
  const sectionIds = new Set<string>();

  let current = graph.ordered[0];
  while (current !== undefined && !sectionIds.has(current.id)) {
    sections.push(current);
    sectionIds.add(current.id);
    const next = nextSectionFrom(graph, current, answers);
    current =
      next.kind === "section" ? graph.byId.get(next.sectionId) : undefined;
  }

  const questions = sections.flatMap((section) =>
    [...section.questions].sort(byPosition),
  );

  return {
    sections,
    questions,
    sectionIds,
    questionIds: new Set(questions.map((question) => question.id)),
  };
}
