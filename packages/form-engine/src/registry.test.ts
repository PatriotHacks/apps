import { describe, expect, it } from "vitest";
import {
  BRANCHABLE_QUESTION_TYPES,
  QUESTION_TYPE_REGISTRY,
  canBranch,
  getQuestionTypeDefinition,
  hasGrid,
  hasOptions,
} from "./registry";
import { QUESTION_TYPES, isQuestionType, type QuestionType } from "./types";

describe("question types", () => {
  it("declares exactly the 11 types of the Postgres enum, in order", () => {
    expect(QUESTION_TYPES).toEqual([
      "short_answer",
      "paragraph",
      "multiple_choice",
      "checkboxes",
      "dropdown",
      "linear_scale",
      "date",
      "time",
      "grid_multiple_choice",
      "grid_checkbox",
      "file_upload",
    ]);
  });

  it("has no duplicates", () => {
    expect(new Set(QUESTION_TYPES).size).toBe(QUESTION_TYPES.length);
  });

  it("narrows unknown strings", () => {
    expect(isQuestionType("short_answer")).toBe(true);
    expect(isQuestionType("shortanswer")).toBe(false);
    expect(isQuestionType(3)).toBe(false);
  });
});

describe("registry", () => {
  it("has one entry per question type and nothing else", () => {
    expect(Object.keys(QUESTION_TYPE_REGISTRY)).toEqual([...QUESTION_TYPES]);
  });

  it.each(QUESTION_TYPES)("%s carries a complete definition", (type) => {
    const definition = getQuestionTypeDefinition(type);
    expect(definition.label.length).toBeGreaterThan(0);
    expect(definition.valueSchema).toBeDefined();
    expect(definition.configSchema).toBeDefined();
    expect(typeof definition.checkConstraints).toBe("function");
  });

  it("allows branching only on the single-select choice types", () => {
    const branchable = QUESTION_TYPES.filter(canBranch);
    expect(branchable).toEqual(["multiple_choice", "dropdown"]);
    expect(BRANCHABLE_QUESTION_TYPES).toEqual(branchable);
  });

  it("marks the choice types as taking options", () => {
    expect(QUESTION_TYPES.filter(hasOptions)).toEqual([
      "multiple_choice",
      "checkboxes",
      "dropdown",
    ]);
  });

  it("marks the grid types as taking rows and columns", () => {
    expect(QUESTION_TYPES.filter(hasGrid)).toEqual([
      "grid_multiple_choice",
      "grid_checkbox",
    ]);
  });

  it("never marks a type as taking both options and grid axes", () => {
    const both = QUESTION_TYPES.filter(
      (type: QuestionType) => hasOptions(type) && hasGrid(type),
    );
    expect(both).toEqual([]);
  });

  it("only lets types that take options carry branching", () => {
    const branchingWithoutOptions = QUESTION_TYPES.filter(
      (type: QuestionType) => canBranch(type) && !hasOptions(type),
    );
    expect(branchingWithoutOptions).toEqual([]);
  });
});
