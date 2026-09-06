import { describe, expect, it } from "vitest";
import {
  SUBMIT,
  makeBranchQuestion,
  makeChoiceQuestion,
  makeForm,
  makeSection,
} from "./test-fixtures";
import {
  branchingQuestions,
  firstSection,
  resolveNextSection,
  selectedOption,
} from "./traverse";
import type { FormSection } from "./types";

function section(
  id: string,
  position: number,
  overrides: Partial<FormSection> = {},
): FormSection {
  return makeSection({ id, position, ...overrides });
}

describe("first section", () => {
  it("is the lowest position, not the array order", () => {
    const form = makeForm([section("c", 3), section("a", 1), section("b", 2)]);
    expect(firstSection(form)?.id).toBe("a");
  });

  it("is null for a form with no sections", () => {
    expect(firstSection(makeForm([]))).toBeNull();
  });
});

describe("selected option", () => {
  it("matches on the option value the answer stores", () => {
    const question = makeChoiceQuestion("multiple_choice", ["yes", "no"]);
    expect(selectedOption(question, "no")?.value).toBe("no");
  });

  it("is null for no answer, an unknown value, or a non-string blob", () => {
    const question = makeChoiceQuestion("multiple_choice", ["yes", "no"]);
    expect(selectedOption(question, undefined)).toBeNull();
    expect(selectedOption(question, "maybe")).toBeNull();
    expect(selectedOption(question, ["yes"])).toBeNull();
  });
});

describe("branching questions", () => {
  it("keeps only the types the registry says can branch", () => {
    const branching = makeBranchQuestion("dropdown", { yes: "b" });
    const checkboxes = makeChoiceQuestion("checkboxes", ["yes", "no"]);
    const found = branchingQuestions(
      section("a", 1, { questions: [checkboxes, branching] }),
    );
    expect(found.map((question) => question.id)).toEqual([branching.id]);
  });
});

describe("next section", () => {
  it("advances by position when the action is next", () => {
    const form = makeForm([section("a", 1), section("b", 2)]);
    expect(resolveNextSection(form, "a", {})).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });

  it("advances by position, not by array order", () => {
    const form = makeForm([section("c", 3), section("a", 1), section("b", 2)]);
    expect(resolveNextSection(form, "a", {})).toEqual({
      kind: "section",
      sectionId: "b",
    });
    expect(resolveNextSection(form, "b", {})).toEqual({
      kind: "section",
      sectionId: "c",
    });
  });

  it("submits after the last section", () => {
    const form = makeForm([section("a", 1), section("b", 2)]);
    expect(resolveNextSection(form, "b", {})).toEqual({ kind: "submit" });
  });

  it("submits when the section's own action says so", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "submit" }),
      section("b", 2),
    ]);
    expect(resolveNextSection(form, "a", {})).toEqual({ kind: "submit" });
  });

  it("jumps when the section's own action names a target", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "section", nextSectionId: "c" }),
      section("b", 2),
      section("c", 3),
    ]);
    expect(resolveNextSection(form, "a", {})).toEqual({
      kind: "section",
      sectionId: "c",
    });
  });

  it("submits for a section id the form does not contain", () => {
    const form = makeForm([section("a", 1)]);
    expect(resolveNextSection(form, "missing", {})).toEqual({ kind: "submit" });
  });
});

describe("option branching", () => {
  it("beats the section's own action", () => {
    const question = makeBranchQuestion("multiple_choice", {
      yes: "c",
      no: null,
    });
    const form = makeForm([
      section("a", 1, {
        questions: [question],
        nextAction: "section",
        nextSectionId: "b",
      }),
      section("b", 2),
      section("c", 3),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: "yes" })).toEqual({
      kind: "section",
      sectionId: "c",
    });
  });

  it("beats an explicit submit on the section", () => {
    const question = makeBranchQuestion("dropdown", { yes: "b" });
    const form = makeForm([
      section("a", 1, { questions: [question], nextAction: "submit" }),
      section("b", 2),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: "yes" })).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });

  it("falls through to the section's action when unanswered", () => {
    const question = makeBranchQuestion("multiple_choice", { yes: "c" });
    const form = makeForm([
      section("a", 1, {
        questions: [question],
        nextAction: "section",
        nextSectionId: "b",
      }),
      section("b", 2),
      section("c", 3),
    ]);
    expect(resolveNextSection(form, "a", {})).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });

  it("falls through when the selected option does not jump", () => {
    const question = makeBranchQuestion("multiple_choice", {
      yes: "c",
      no: null,
    });
    const form = makeForm([
      section("a", 1, { questions: [question] }),
      section("b", 2),
      section("c", 3),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: "no" })).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });

  it("ignores a jump carried by a type that cannot branch", () => {
    const question = makeChoiceQuestion("checkboxes", ["yes", "no"]);
    question.options[0] = {
      ...question.options[0]!,
      nextAction: "section",
      nextSectionId: "c",
    };
    const form = makeForm([
      section("a", 1, { questions: [question] }),
      section("b", 2),
      section("c", 3),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: ["yes"] })).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });

  it("ignores a target that is not a section of this form", () => {
    const question = makeBranchQuestion("dropdown", { yes: "elsewhere" });
    const form = makeForm([
      section("a", 1, { questions: [question] }),
      section("b", 2),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: "yes" })).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });

  it("ends the form when the selected option submits", () => {
    const question = makeBranchQuestion("multiple_choice", {
      done: SUBMIT,
      more: null,
    });
    const form = makeForm([
      section("a", 1, { questions: [question] }),
      section("b", 2),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: "done" })).toEqual({
      kind: "submit",
    });
  });

  it("lets a submitting option beat the section's own jump", () => {
    const question = makeBranchQuestion("dropdown", { done: SUBMIT });
    const form = makeForm([
      section("a", 1, {
        questions: [question],
        nextAction: "section",
        nextSectionId: "c",
      }),
      section("b", 2),
      section("c", 3),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: "done" })).toEqual({
      kind: "submit",
    });
  });

  it("leaves the other options of a submitting question alone", () => {
    const question = makeBranchQuestion("multiple_choice", {
      done: SUBMIT,
      more: null,
    });
    const form = makeForm([
      section("a", 1, { questions: [question] }),
      section("b", 2),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: "more" })).toEqual({
      kind: "section",
      sectionId: "b",
    });
    expect(resolveNextSection(form, "a", {})).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });

  it("ignores a submitting option on a type that cannot branch", () => {
    const question = makeChoiceQuestion("checkboxes", ["done"]);
    question.options[0] = { ...question.options[0]!, nextAction: "submit" };
    const form = makeForm([
      section("a", 1, { questions: [question] }),
      section("b", 2),
    ]);
    expect(resolveNextSection(form, "a", { [question.id]: ["done"] })).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });

  it("ignores a section action that names no target", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "section", nextSectionId: null }),
      section("b", 2),
    ]);
    expect(resolveNextSection(form, "a", {})).toEqual({
      kind: "section",
      sectionId: "b",
    });
  });
});

describe("two branching questions in one section", () => {
  it("lets the earlier question by position win", () => {
    const second = makeBranchQuestion("dropdown", { pick: "d" }, { position: 2 });
    const first = makeBranchQuestion(
      "multiple_choice",
      { pick: "c" },
      { position: 1 },
    );
    const form = makeForm([
      section("a", 1, { questions: [second, first] }),
      section("b", 2),
      section("c", 3),
      section("d", 4),
    ]);
    const answers = { [first.id]: "pick", [second.id]: "pick" };
    expect(resolveNextSection(form, "a", answers)).toEqual({
      kind: "section",
      sectionId: "c",
    });
  });

  it("counts a submitting option as a resolved outcome, so the earlier wins", () => {
    const first = makeBranchQuestion(
      "multiple_choice",
      { pick: SUBMIT },
      { position: 1 },
    );
    const second = makeBranchQuestion("dropdown", { pick: "c" }, { position: 2 });
    const form = makeForm([
      section("a", 1, { questions: [second, first] }),
      section("b", 2),
      section("c", 3),
    ]);
    const answers = { [first.id]: "pick", [second.id]: "pick" };
    expect(resolveNextSection(form, "a", answers)).toEqual({ kind: "submit" });
  });

  it("falls to the later question when the earlier one resolves nothing", () => {
    const first = makeBranchQuestion(
      "multiple_choice",
      { pick: "c" },
      { position: 1 },
    );
    const second = makeBranchQuestion("dropdown", { pick: "d" }, { position: 2 });
    const form = makeForm([
      section("a", 1, { questions: [first, second] }),
      section("b", 2),
      section("c", 3),
      section("d", 4),
    ]);
    expect(resolveNextSection(form, "a", { [second.id]: "pick" })).toEqual({
      kind: "section",
      sectionId: "d",
    });
  });
});
