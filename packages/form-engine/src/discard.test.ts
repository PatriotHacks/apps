import { describe, expect, it } from "vitest";
import { orphanedQuestionIds } from "./discard";
import {
  makeBranchQuestion,
  makeForm,
  makeQuestion,
  makeSection,
} from "./test-fixtures";
import type { FormSection } from "./types";

function section(
  id: string,
  position: number,
  overrides: Partial<FormSection> = {},
): FormSection {
  return makeSection({ id, position, ...overrides });
}

const branch = makeBranchQuestion(
  "multiple_choice",
  { yes: "yes-path", no: "no-path" },
  { id: "branch" },
);
const yesFirst = makeQuestion("short_answer", { id: "yes-1", position: 1 });
const yesSecond = makeQuestion("paragraph", { id: "yes-2", position: 2 });
const noQuestion = makeQuestion("short_answer", { id: "no-1" });
const endQuestion = makeQuestion("short_answer", { id: "end-1" });

const form = makeForm([
  section("start", 1, { questions: [branch] }),
  section("yes-path", 2, {
    questions: [yesSecond, yesFirst],
    nextAction: "section",
    nextSectionId: "end",
  }),
  section("no-path", 3, { questions: [noQuestion] }),
  section("end", 4, { questions: [endQuestion] }),
]);

describe("flipping a branch", () => {
  it("orphans exactly the answers on the abandoned path", () => {
    const previous = {
      branch: "yes",
      "yes-1": "typed this",
      "yes-2": "and this",
      "end-1": "kept",
    };
    expect(orphanedQuestionIds(form, previous, { ...previous, branch: "no" })
    ).toEqual(["yes-1", "yes-2"]);
  });

  it("orphans nothing on the path being switched to", () => {
    const previous = { branch: "no", "no-1": "typed this" };
    expect(
      orphanedQuestionIds(form, previous, { ...previous, branch: "yes" }),
    ).toEqual(["no-1"]);
  });

  it("keeps answers on sections both paths converge on", () => {
    const previous = { branch: "yes", "end-1": "kept" };
    const orphaned = orphanedQuestionIds(form, previous, {
      ...previous,
      branch: "no",
    });
    expect(orphaned).not.toContain("end-1");
  });

  it("never orphans the branching question itself", () => {
    const previous = { branch: "yes", "yes-1": "typed" };
    expect(
      orphanedQuestionIds(form, previous, { ...previous, branch: "no" }),
    ).not.toContain("branch");
  });

  it("orphans the default path when a branch is answered for the first time", () => {
    const previous = { "yes-1": "typed while unanswered" };
    expect(orphanedQuestionIds(form, previous, { branch: "no" })).toEqual([
      "yes-1",
    ]);
  });
});

describe("changes that move nothing", () => {
  it("returns nothing when only a value changed", () => {
    const previous = { branch: "yes", "yes-1": "first draft" };
    expect(
      orphanedQuestionIds(form, previous, { ...previous, "yes-1": "second" }),
    ).toEqual([]);
  });

  it("returns nothing when the answers are identical", () => {
    const previous = { branch: "yes", "yes-1": "typed" };
    expect(orphanedQuestionIds(form, previous, previous)).toEqual([]);
  });

  it("returns nothing for a form with no branching", () => {
    const linear = makeForm([
      section("a", 1, { questions: [makeQuestion("short_answer", { id: "q" })] }),
      section("b", 2),
    ]);
    expect(orphanedQuestionIds(linear, { q: "typed" }, { q: "changed" })).toEqual(
      [],
    );
  });
});

describe("questions holding nothing", () => {
  it("skips a question that was never answered", () => {
    expect(
      orphanedQuestionIds(form, { branch: "yes" }, { branch: "no" }),
    ).toEqual([]);
  });

  it("skips answers that are blank, empty, or whitespace", () => {
    const previous = {
      branch: "yes",
      "yes-1": "   ",
      "yes-2": "",
    };
    expect(orphanedQuestionIds(form, previous, { branch: "no" })).toEqual([]);
  });
});

describe("jumping past a section", () => {
  it("orphans the answers of every section the jump skips", () => {
    const skip = makeBranchQuestion(
      "dropdown",
      { skip: "last", stay: null },
      { id: "skip" },
    );
    const skipped = makeQuestion("short_answer", { id: "middle-1" });
    const jumper = makeForm([
      section("a", 1, { questions: [skip] }),
      section("middle", 2, { questions: [skipped] }),
      section("last", 3),
    ]);
    const previous = { skip: "stay", "middle-1": "typed" };
    expect(
      orphanedQuestionIds(jumper, previous, { ...previous, skip: "skip" }),
    ).toEqual(["middle-1"]);
  });

  it("orphans everything after a branch that submits early", () => {
    const stop = makeBranchQuestion("dropdown", { stop: "end" }, { id: "stop" });
    const laterQuestion = makeQuestion("short_answer", { id: "later-1" });
    const early = makeForm([
      section("a", 1, { questions: [stop] }),
      section("later", 2, { questions: [laterQuestion] }),
      section("end", 3, { nextAction: "submit" }),
    ]);
    const previous = { "later-1": "typed" };
    expect(orphanedQuestionIds(early, previous, { stop: "stop" })).toEqual([
      "later-1",
    ]);
  });
});
