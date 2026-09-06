import { describe, expect, it } from "vitest";
import { parseAnswerValue, parseTypedAnswer } from "./parse";
import { QUESTION_TYPES, type QuestionType } from "./types";

/** One valid and several invalid blobs for every question type. */
const CASES: {
  [K in QuestionType]: { valid: unknown[]; invalid: unknown[] };
} = {
  short_answer: {
    valid: ["Ada Lovelace", ""],
    invalid: [42, null, ["a"], { value: "a" }],
  },
  paragraph: {
    valid: ["line one\nline two"],
    invalid: [7, false, ["a"]],
  },
  multiple_choice: {
    valid: ["yes"],
    invalid: [1, ["yes"], null],
  },
  checkboxes: {
    valid: [["a", "b"], []],
    invalid: ["a", [1, 2], [["a"]], { a: true }],
  },
  dropdown: {
    valid: ["gmu"],
    invalid: [null, 3, ["gmu"]],
  },
  linear_scale: {
    valid: [3, 0, -1],
    invalid: ["3", 3.5, null, [3]],
  },
  date: {
    valid: ["2026-03-14", "2024-02-29"],
    invalid: ["2026-02-30", "2026-13-01", "14/03/2026", "2026-3-4", 20260314],
  },
  time: {
    valid: ["09:30", "23:59", "09:30:15"],
    invalid: ["9:30", "24:00", "09:60", "half nine", 930],
  },
  grid_multiple_choice: {
    valid: [{ row_1: "col_1" }, {}],
    invalid: [{ row_1: ["col_1"] }, [["row_1", "col_1"]], "row_1", 1],
  },
  grid_checkbox: {
    valid: [{ row_1: ["col_1", "col_2"] }, { row_1: [] }, {}],
    invalid: [{ row_1: "col_1" }, { row_1: [1] }, ["col_1"]],
  },
  file_upload: {
    valid: [{ path: "u/1/cv.pdf", name: "cv.pdf", size: 12345 }],
    invalid: [
      { path: "u/1/cv.pdf", name: "cv.pdf" },
      { path: "", name: "cv.pdf", size: 1 },
      { path: "u/1/cv.pdf", name: "cv.pdf", size: -1 },
      { path: "u/1/cv.pdf", name: "cv.pdf", size: 1.5 },
      { path: "u/1/cv.pdf", name: "cv.pdf", size: 1, mimeType: "application/pdf" },
      "cv.pdf",
    ],
  },
};

describe.each(QUESTION_TYPES)("%s value schema", (type) => {
  it("accepts every valid shape", () => {
    for (const value of CASES[type].valid) {
      const result = parseAnswerValue(type, value);
      expect(result.success, `${JSON.stringify(value)} should parse`).toBe(true);
      if (result.success) expect(result.data).toEqual(value);
    }
  });

  it("rejects every invalid shape with structured issues", () => {
    for (const value of CASES[type].invalid) {
      const result = parseAnswerValue(type, value);
      expect(result.success, `${JSON.stringify(value)} should fail`).toBe(false);
      if (!result.success) {
        expect(result.issues.length).toBeGreaterThan(0);
        for (const issue of result.issues) {
          expect(typeof issue.code).toBe("string");
          expect(typeof issue.message).toBe("string");
          expect(Array.isArray(issue.path)).toBe(true);
        }
      }
    }
  });
});

describe("typed answer envelope", () => {
  it("parses a matching type and value pair", () => {
    const result = parseTypedAnswer({ type: "linear_scale", value: 4 });
    expect(result).toEqual({
      success: true,
      data: { type: "linear_scale", value: 4 },
    });
  });

  it("rejects a value that belongs to a different type", () => {
    const result = parseTypedAnswer({ type: "linear_scale", value: ["a"] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown question type", () => {
    expect(parseTypedAnswer({ type: "signature", value: "x" }).success).toBe(
      false,
    );
  });
});
