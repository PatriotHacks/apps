import { describe, expect, it } from "vitest";
import { computeReachability } from "./reachability";
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

function ids(form: Parameters<typeof computeReachability>[0], answers = {}) {
  return computeReachability(form, answers).sections.map(
    (visited) => visited.id,
  );
}

describe("linear forms", () => {
  it("reaches every section in position order", () => {
    const form = makeForm([
      section("c", 3),
      section("a", 1),
      section("b", 2),
    ]);
    expect(ids(form)).toEqual(["a", "b", "c"]);
  });

  it("reaches every question, ordered by position within a section", () => {
    const second = makeQuestion("short_answer", { id: "q2", position: 2 });
    const first = makeQuestion("paragraph", { id: "q1", position: 1 });
    const third = makeQuestion("short_answer", { id: "q3", position: 1 });
    const form = makeForm([
      section("a", 1, { questions: [second, first] }),
      section("b", 2, { questions: [third] }),
    ]);
    const reachable = computeReachability(form, {});
    expect(reachable.questions.map((question) => question.id)).toEqual([
      "q1",
      "q2",
      "q3",
    ]);
    expect(reachable.questionIds).toEqual(new Set(["q1", "q2", "q3"]));
  });

  it("is empty for a form with no sections", () => {
    const reachable = computeReachability(makeForm([]), {});
    expect(reachable.sections).toEqual([]);
    expect(reachable.questions).toEqual([]);
    expect(reachable.sectionIds.size).toBe(0);
    expect(reachable.questionIds.size).toBe(0);
  });
});

describe("branching", () => {
  const branch = makeBranchQuestion("multiple_choice", {
    yes: "yes-path",
    no: "no-path",
  });
  const yesQuestion = makeQuestion("short_answer", { id: "yes-q" });
  const noQuestion = makeQuestion("short_answer", { id: "no-q" });
  const form = makeForm([
    section("start", 1, { questions: [branch] }),
    section("yes-path", 2, {
      questions: [yesQuestion],
      nextAction: "section",
      nextSectionId: "end",
    }),
    section("no-path", 3, { questions: [noQuestion] }),
    section("end", 4),
  ]);

  it("reaches only the chosen branch when the answer is yes", () => {
    const reachable = computeReachability(form, { [branch.id]: "yes" });
    expect(reachable.sections.map((visited) => visited.id)).toEqual([
      "start",
      "yes-path",
      "end",
    ]);
    expect(reachable.questionIds.has("yes-q")).toBe(true);
    expect(reachable.questionIds.has("no-q")).toBe(false);
  });

  it("reaches only the other branch when the answer is no", () => {
    const reachable = computeReachability(form, { [branch.id]: "no" });
    expect(reachable.sections.map((visited) => visited.id)).toEqual([
      "start",
      "no-path",
      "end",
    ]);
    expect(reachable.questionIds.has("no-q")).toBe(true);
    expect(reachable.questionIds.has("yes-q")).toBe(false);
  });

  it("reaches a section that both paths converge on", () => {
    expect(
      computeReachability(form, { [branch.id]: "yes" }).sectionIds.has("end"),
    ).toBe(true);
    expect(
      computeReachability(form, { [branch.id]: "no" }).sectionIds.has("end"),
    ).toBe(true);
  });

  it("takes the positional path while the branching question is unanswered", () => {
    expect(ids(form, {})).toEqual(["start", "yes-path", "end"]);
  });

  it("takes the positional path for an answer that matches no option", () => {
    expect(ids(form, { [branch.id]: "maybe" })).toEqual([
      "start",
      "yes-path",
      "end",
    ]);
  });
});

describe("submit", () => {
  it("leaves every later section unreachable", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "submit" }),
      section("b", 2, { questions: [makeQuestion("short_answer", { id: "q" })] }),
      section("c", 3),
    ]);
    const reachable = computeReachability(form, {});
    expect(reachable.sections.map((visited) => visited.id)).toEqual(["a"]);
    expect(reachable.questionIds.has("q")).toBe(false);
  });

  it("can be reached through a branch, cutting the rest of the form off", () => {
    const branch = makeBranchQuestion("dropdown", { stop: "last" });
    const form = makeForm([
      section("a", 1, { questions: [branch] }),
      section("skipped", 2),
      section("last", 3, { nextAction: "submit" }),
    ]);
    expect(ids(form, { [branch.id]: "stop" })).toEqual(["a", "last"]);
  });
});

describe("malformed graphs", () => {
  it("terminates on a backward jump that forms a cycle", () => {
    const form = makeForm([
      section("a", 1),
      section("b", 2, { nextAction: "section", nextSectionId: "a" }),
    ]);
    expect(ids(form)).toEqual(["a", "b"]);
  });

  it("terminates on a self loop", () => {
    const form = makeForm([
      section("a", 1, { nextAction: "section", nextSectionId: "a" }),
      section("b", 2),
    ]);
    expect(ids(form)).toEqual(["a"]);
  });

  it("terminates on a cycle entered through a branching option", () => {
    const branch = makeBranchQuestion("multiple_choice", { back: "a" });
    const form = makeForm([
      section("a", 1),
      section("b", 2, { questions: [branch] }),
      section("c", 3),
    ]);
    expect(ids(form, { [branch.id]: "back" })).toEqual(["a", "b"]);
  });
});
