import {
  branchingQuestions,
  buildSectionGraph,
  byPosition,
} from "./traverse";
import { choiceOptions, type FormDefinition, type FormSection } from "./types";

/**
 * Publish-time validation of the section graph.
 *
 * A published form is immutable, so a bad graph can never be repaired — these
 * checks are the only chance to catch one. Two invariants:
 *
 * - **No unreachable sections.** Every section is reachable from the first
 *   along some path, for some set of answers.
 * - **No cycles.** A jump target must have a strictly higher `position` than
 *   its source. Forbidding backward jumps makes cycles structurally impossible
 *   and keeps a progress indicator honest.
 *
 * A third code, `missing_target`, covers a jump that names no section or names
 * one that is not part of this form. Traversal degrades to positional order in
 * that case, which is never what the builder meant.
 */
export type GraphErrorCode =
  | "missing_target"
  | "backward_jump"
  | "unreachable_section";

/**
 * A problem with one jump or one section. `questionId` and `optionId` are set
 * when the offender is a branching option and null when it is the section's
 * own `nextAction`.
 */
export interface GraphError {
  code: GraphErrorCode;
  message: string;
  sectionId: string;
  questionId: string | null;
  optionId: string | null;
  targetSectionId: string | null;
}

export interface GraphValidationResult {
  success: boolean;
  errors: GraphError[];
}

/** One `nextAction: 'section'` edge as written, before its target is checked. */
interface Jump {
  sectionId: string;
  questionId: string | null;
  optionId: string | null;
  targetSectionId: string | null;
  label: string;
}

/**
 * Every jump a section declares: its own action first, then the options of its
 * branching questions in position order. Options on types that cannot branch
 * are skipped, because traversal never follows them.
 */
function jumps(section: FormSection): Jump[] {
  const declared: Jump[] = [];

  if (section.nextAction === "section") {
    declared.push({
      sectionId: section.id,
      questionId: null,
      optionId: null,
      targetSectionId: section.nextSectionId,
      label: `Section "${section.title}"`,
    });
  }

  for (const question of branchingQuestions(section)) {
    for (const option of [...choiceOptions(question)].sort(byPosition)) {
      if (option.nextAction !== "section") continue;
      declared.push({
        sectionId: section.id,
        questionId: question.id,
        optionId: option.id,
        targetSectionId: option.nextSectionId,
        label: `Option "${option.label}" of "${question.label}"`,
      });
    }
  }

  return declared;
}

export function validateFormGraph(form: FormDefinition): GraphValidationResult {
  const graph = buildSectionGraph(form);
  const errors: GraphError[] = [];
  const edges = new Map<string, string[]>();

  for (const [index, section] of graph.ordered.entries()) {
    const targets: string[] = [];
    // Traversal falls through to positional order when the section's own jump
    // resolves to nothing, so reachability is computed the same way — one
    // dangling pointer should not also report every section behind it as
    // unreachable.
    let fallsThrough = section.nextAction === "next";

    for (const { label, ...jump } of jumps(section)) {
      const target =
        jump.targetSectionId === null
          ? undefined
          : graph.byId.get(jump.targetSectionId);

      if (target === undefined) {
        errors.push({
          ...jump,
          code: "missing_target",
          message: `${label} jumps to a section that is not part of this form`,
        });
        if (jump.optionId === null) fallsThrough = true;
        continue;
      }

      if (target.position <= section.position) {
        errors.push({
          ...jump,
          code: "backward_jump",
          message: `${label} jumps back to "${target.title}"; a jump target must come after its source`,
        });
      }

      targets.push(target.id);
    }

    if (fallsThrough) {
      const following = graph.ordered[index + 1];
      if (following !== undefined) targets.push(following.id);
    }

    edges.set(section.id, targets);
  }

  const start = graph.ordered[0];
  if (start !== undefined) {
    const seen = new Set([start.id]);
    const stack = [start.id];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) break;
      for (const target of edges.get(current) ?? []) {
        if (seen.has(target)) continue;
        seen.add(target);
        stack.push(target);
      }
    }

    for (const section of graph.ordered) {
      if (seen.has(section.id)) continue;
      errors.push({
        code: "unreachable_section",
        message: `Section "${section.title}" cannot be reached from the first section`,
        sectionId: section.id,
        questionId: null,
        optionId: null,
        targetSectionId: null,
      });
    }
  }

  return { success: errors.length === 0, errors };
}
