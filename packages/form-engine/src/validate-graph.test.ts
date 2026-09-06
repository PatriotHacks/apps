import { describe, expect, it } from "vitest";
import {
  makeBranchQuestion,
  makeChoiceQuestion,
  makeForm,
  makeSection,
} from "./test-fixtures";
import type { FormSection } from "./types";
import { validateFormGraph } from "./validate-graph";

function section(
  id: string,
  position: number,
  overrides: Partial<FormSection> = {},
): FormSection {
  return makeSection({ id, position, ...overrides });
}

function summary(form: Parameters<typeof validateFormGraph>[0]) {
  return validateFormGraph(form).errors.map((error) => [
    error.code,
    error.sectionId,
    error.targetSectionId,
  ]);
}

describe("valid graphs", () => {
  it("accepts a linear form", () => {
    const form = makeForm([section("a", 1), section("b", 2), section("c", 3)]);
    expect(validateFormGraph(form)).toEqual({ success: true, errors: [] });
  });

  it("accepts a forward branch where both paths converge", () => {
    const branch = makeBranchQuestion("multiple_choice", {
      yes: "yes-path",
      no: "no-path",
    });
    const form = makeForm([
      section("start", 1, { questions: [branch] }),
      section("yes-path", 2, {
        nextAction: "section",
        nextSectionId: "end",
      }),
      section("no-path", 3),
      section("end", 4),
    ]);
    expect(validateFormGraph(form)).toEqual({ success: true, errors: [] });
  });

  it("accepts a section reachable only through a branching option", () => {
    const branch = makeBranchQuestion("dropdown", { yes: "extra" });
    const form = makeForm([
      section("a", 1, { questions: [branch], nextAction: "submit" }),
      section("extra", 2),
    ]);
    expect(validateFormGraph(form)).toEqual({ success: true, errors: [] });
  });

  it("accepts a single section", () => {
    expect(validateFormGraph(makeForm([section("only", 1)]))).toEqual({
      success: true,
      errors: [],
    });
  });
});

describe("empty forms", () => {
  it("refuses to publish a form with no sections", () => {
    expect(validateFormGraph(makeForm([]))).toEqual({
      success: false,
      errors: [
        {
          code: "empty_form",
          message: expect.any(String),
          sectionId: null,
          questionId: null,
          optionId: null,
          targetSectionId: null,
        },
      ],
    });
  });
});

describe("unreachable sections", () => {
  it("catches a section every path jumps over", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "section", nextSectionId: "c" }),
      section("b", 2),
      section("c", 3),
    ]);
    expect(summary(form)).toEqual([["unreachable_section", "b", null]]);
  });

  it("catches everything after an early submit", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "submit" }),
      section("b", 2),
      section("c", 3),
    ]);
    expect(summary(form)).toEqual([
      ["unreachable_section", "b", null],
      ["unreachable_section", "c", null],
    ]);
  });

  it("reports the offending section, not a boolean", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "submit" }),
      section("orphan", 2, { title: "Orphan" }),
    ]);
    expect(validateFormGraph(form).errors).toEqual([
      {
        code: "unreachable_section",
        message: expect.stringContaining("Orphan"),
        sectionId: "orphan",
        questionId: null,
        optionId: null,
        targetSectionId: null,
      },
    ]);
  });

  it("ignores a jump declared by a type that cannot branch", () => {
    const question = makeChoiceQuestion("checkboxes", ["yes", "no"]);
    question.options[0] = {
      ...question.options[0]!,
      nextAction: "section",
      nextSectionId: "c",
    };
    const form = makeForm([
      section("a", 1, { questions: [question] }),
      section("b", 2, { nextAction: "submit" }),
      section("c", 3),
    ]);
    expect(summary(form)).toEqual([["unreachable_section", "c", null]]);
  });
});

describe("backward jumps", () => {
  it("catches a section jumping to an earlier position", () => {
    const form = makeForm([
      section("a", 1),
      section("b", 2, { nextAction: "section", nextSectionId: "a" }),
    ]);
    expect(summary(form)).toEqual([["backward_jump", "b", "a"]]);
  });

  it("catches a section jumping to itself", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "section", nextSectionId: "a" }),
      section("b", 2),
    ]);
    expect(summary(form)).toEqual([
      ["backward_jump", "a", "a"],
      ["unreachable_section", "b", null],
    ]);
  });

  it("catches a branching option jumping backwards and names the option", () => {
    const branch = makeBranchQuestion("multiple_choice", { back: "a" });
    const form = makeForm([
      section("a", 1),
      section("b", 2, { questions: [branch] }),
    ]);
    const option = branch.options[0]!;
    expect(validateFormGraph(form).errors).toEqual([
      {
        code: "backward_jump",
        message: expect.any(String),
        sectionId: "b",
        questionId: branch.id,
        optionId: option.id,
        targetSectionId: "a",
      },
    ]);
  });
});

describe("missing targets", () => {
  it("catches a section action with no target", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "section", nextSectionId: null }),
      section("b", 2),
    ]);
    expect(summary(form)).toEqual([["missing_target", "a", null]]);
  });

  it("catches a target that belongs to another form", () => {
    const branch = makeBranchQuestion("dropdown", { yes: "elsewhere" });
    const form = makeForm([
      section("a", 1, { questions: [branch] }),
      section("b", 2),
    ]);
    expect(summary(form)).toEqual([["missing_target", "a", "elsewhere"]]);
  });
});

describe("multiple problems", () => {
  it("reports every offender in section order", () => {
    const branch = makeBranchQuestion("multiple_choice", { back: "a" });
    const form = makeForm([
      section("a", 1, { nextAction: "section", nextSectionId: "missing" }),
      section("b", 2, { questions: [branch], nextAction: "submit" }),
      section("c", 3),
    ]);
    expect(summary(form)).toEqual([
      ["missing_target", "a", "missing"],
      ["backward_jump", "b", "a"],
      ["unreachable_section", "c", null],
    ]);
  });
});
