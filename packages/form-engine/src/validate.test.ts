import { describe, expect, it } from "vitest";
import { isEmptyAnswerValue, mimeTypeForFileName } from "./issues";
import {
  makeChoiceQuestion,
  makeGridQuestion,
  makeQuestion,
} from "./test-fixtures";
import { QUESTION_TYPES, type QuestionType } from "./types";
import { validateAnswer, validateAnswers } from "./validate";

function codes(question: Parameters<typeof validateAnswer>[0], value: unknown) {
  const result = validateAnswer(question, value);
  return result.success ? [] : result.errors.map((error) => error.code);
}

/** Blobs that must count as "not answered" for each type. */
const EMPTY_VALUES: Record<QuestionType, unknown[]> = {
  short_answer: [undefined, null, "", "   "],
  paragraph: [undefined, null, "", "\n\t "],
  multiple_choice: [undefined, null, ""],
  checkboxes: [undefined, null, [], ["", ""]],
  dropdown: [undefined, null, ""],
  linear_scale: [undefined, null],
  date: [undefined, null, ""],
  time: [undefined, null, ""],
  grid_multiple_choice: [undefined, null, {}, { row_1: "" }],
  grid_checkbox: [undefined, null, {}, { row_1: [] }],
  file_upload: [undefined, null, {}],
};

describe("required answers", () => {
  it.each(QUESTION_TYPES)("flags every empty shape for %s", (type) => {
    const question = makeQuestion(type, { required: true });
    for (const value of EMPTY_VALUES[type]) {
      const result = validateAnswer(question, value);
      expect(result.success, `${JSON.stringify(value)} should be empty`).toBe(
        false,
      );
      if (!result.success) {
        expect(result.errors).toEqual([
          {
            questionId: question.id,
            code: "required",
            message: expect.any(String),
            path: [],
          },
        ]);
      }
    }
  });

  it.each(QUESTION_TYPES)("lets an optional %s stay blank", (type) => {
    const question = makeQuestion(type, { required: false });
    for (const value of EMPTY_VALUES[type]) {
      expect(validateAnswer(question, value)).toEqual({
        success: true,
        questionId: question.id,
        answer: null,
      });
    }
  });

  it("treats zero on a linear scale as a real answer", () => {
    expect(isEmptyAnswerValue(0)).toBe(false);
    const question = makeQuestion("linear_scale", {
      required: true,
      config: { min: 0, max: 10 },
    });
    expect(validateAnswer(question, 0)).toEqual({
      success: true,
      questionId: question.id,
      answer: { type: "linear_scale", value: 0 },
    });
  });

  it("treats false as a real answer even though it fails the shape check", () => {
    expect(isEmptyAnswerValue(false)).toBe(false);
    expect(codes(makeQuestion("short_answer", { required: true }), false)).toEqual([
      "invalid_value",
    ]);
  });
});

describe("shape failures", () => {
  it("reports a value of the wrong type without throwing", () => {
    const question = makeQuestion("linear_scale", { required: true });
    expect(codes(question, "three")).toEqual(["invalid_value"]);
  });

  it("attaches the question id to every error", () => {
    const question = makeQuestion("checkboxes", { required: true });
    const result = validateAnswer(question, "not-an-array");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.every((e) => e.questionId === question.id)).toBe(
        true,
      );
    }
  });
});

describe("choice references", () => {
  it("accepts an option value that exists", () => {
    const question = makeChoiceQuestion("multiple_choice", ["yes", "no"]);
    expect(validateAnswer(question, "yes")).toEqual({
      success: true,
      questionId: question.id,
      answer: { type: "multiple_choice", value: "yes" },
    });
  });

  it("rejects an option value that does not exist", () => {
    expect(
      codes(makeChoiceQuestion("multiple_choice", ["yes", "no"]), "maybe"),
    ).toEqual(["unknown_option"]);
    expect(codes(makeChoiceQuestion("dropdown", ["gmu"]), "vt")).toEqual([
      "unknown_option",
    ]);
  });

  it("rejects a checkbox selection containing an unknown option", () => {
    expect(
      codes(makeChoiceQuestion("checkboxes", ["a", "b"]), ["a", "z"]),
    ).toEqual(["unknown_option"]);
  });

  it("rejects a repeated checkbox selection", () => {
    expect(
      codes(makeChoiceQuestion("checkboxes", ["a", "b"]), ["a", "a"]),
    ).toEqual(["duplicate_selection"]);
  });

  it("rejects every selection when the question has no options at all", () => {
    expect(codes(makeChoiceQuestion("dropdown", []), "anything")).toEqual([
      "unknown_option",
    ]);
  });

  it("does not accept a grid row id as a choice value", () => {
    const question = makeChoiceQuestion("multiple_choice", ["yes"]);
    expect(codes(question, question.options[0]?.id ?? "")).toEqual([
      "unknown_option",
    ]);
  });
});

describe("grid references", () => {
  const rows = ["row_1", "row_2"];
  const columns = ["col_1", "col_2"];

  it("accepts rows and columns that exist", () => {
    const question = makeGridQuestion("grid_multiple_choice", rows, columns);
    expect(validateAnswer(question, { row_1: "col_2" }).success).toBe(true);
  });

  it("rejects an unknown row id", () => {
    const question = makeGridQuestion("grid_multiple_choice", rows, columns);
    expect(codes(question, { row_9: "col_1" })).toEqual(["unknown_grid_row"]);
  });

  it("rejects an unknown column id", () => {
    const question = makeGridQuestion("grid_multiple_choice", rows, columns);
    expect(codes(question, { row_1: "col_9" })).toEqual([
      "unknown_grid_column",
    ]);
  });

  it("rejects a column id used as a row id", () => {
    const question = makeGridQuestion("grid_multiple_choice", rows, columns);
    expect(codes(question, { col_1: "col_2" })).toEqual(["unknown_grid_row"]);
  });

  it("checks every row of a checkbox grid", () => {
    const question = makeGridQuestion("grid_checkbox", rows, columns);
    expect(validateAnswer(question, { row_1: ["col_1", "col_2"] }).success).toBe(
      true,
    );
    expect(codes(question, { row_1: ["col_1", "col_9"] })).toEqual([
      "unknown_grid_column",
    ]);
    expect(codes(question, { row_9: ["col_1"] })).toEqual(["unknown_grid_row"]);
  });

  it("rejects a column selected twice in the same row", () => {
    const question = makeGridQuestion("grid_checkbox", rows, columns);
    expect(codes(question, { row_1: ["col_1", "col_1"] })).toEqual([
      "duplicate_selection",
    ]);
  });

  it("reports the row in the error path", () => {
    const question = makeGridQuestion("grid_checkbox", rows, columns);
    const result = validateAnswer(question, { row_2: ["col_9"] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.path).toEqual(["row_2", 0]);
    }
  });
});

describe("text constraints", () => {
  const question = makeQuestion("short_answer", {
    config: { minLength: 3, maxLength: 8, pattern: "^[a-z]+$" },
  });

  it("accepts a value inside the bounds", () => {
    expect(validateAnswer(question, "hello").success).toBe(true);
  });

  it("rejects a value that is too short", () => {
    expect(codes(question, "hi")).toEqual(["too_short"]);
  });

  it("rejects a value that is too long", () => {
    expect(codes(question, "abcdefghij")).toEqual(["too_long"]);
  });

  it("rejects a value that does not match the pattern", () => {
    expect(codes(question, "Hello")).toEqual(["pattern_mismatch"]);
  });

  it("reports every violated rule at once", () => {
    expect(codes(question, "ABCDEFGHIJ")).toEqual([
      "too_long",
      "pattern_mismatch",
    ]);
  });
});

describe("scale, date and time constraints", () => {
  it("rejects a scale value outside the configured range", () => {
    const question = makeQuestion("linear_scale", {
      config: { min: 1, max: 5 },
    });
    expect(validateAnswer(question, 5).success).toBe(true);
    expect(codes(question, 6)).toEqual(["out_of_range"]);
    expect(codes(question, -2)).toEqual(["out_of_range"]);
  });

  it("uses the default one to five scale when no config is stored", () => {
    const question = makeQuestion("linear_scale", { config: null });
    expect(validateAnswer(question, 5).success).toBe(true);
    expect(codes(question, 6)).toEqual(["out_of_range"]);
  });

  it("rejects a date outside the configured window", () => {
    const question = makeQuestion("date", {
      config: { min: "2026-01-01", max: "2026-01-31" },
    });
    expect(validateAnswer(question, "2026-01-31").success).toBe(true);
    expect(codes(question, "2025-12-31")).toEqual(["out_of_range"]);
    expect(codes(question, "2026-02-01")).toEqual(["out_of_range"]);
  });

  it("rejects a time outside the configured window", () => {
    const question = makeQuestion("time", {
      config: { min: "09:00", max: "17:00" },
    });
    expect(validateAnswer(question, "09:00").success).toBe(true);
    expect(validateAnswer(question, "17:00:00").success).toBe(true);
    expect(codes(question, "08:59")).toEqual(["out_of_range"]);
    expect(codes(question, "17:00:01")).toEqual(["out_of_range"]);
  });
});

describe("file upload constraints", () => {
  const question = makeQuestion("file_upload", {
    config: { allowedMimeTypes: ["application/pdf"], maxBytes: 1000 },
  });

  it("resolves the content type from the file name", () => {
    expect(mimeTypeForFileName("cv.PDF")).toBe("application/pdf");
    expect(mimeTypeForFileName("archive.tar.gz")).toBe(null);
    expect(mimeTypeForFileName("noextension")).toBe(null);
    expect(mimeTypeForFileName(".gitignore")).toBe(null);
  });

  it("accepts an allowed type within the size cap", () => {
    expect(
      validateAnswer(question, {
        path: "u/1/cv.pdf",
        name: "cv.pdf",
        size: 1000,
      }).success,
    ).toBe(true);
  });

  it("rejects a file over the size cap", () => {
    expect(
      codes(question, { path: "u/1/cv.pdf", name: "cv.pdf", size: 1001 }),
    ).toEqual(["file_too_large"]);
  });

  it("rejects a disallowed content type", () => {
    expect(
      codes(question, { path: "u/1/cv.png", name: "cv.png", size: 10 }),
    ).toEqual(["file_type_not_allowed"]);
  });

  it("rejects a file whose type cannot be determined", () => {
    expect(
      codes(question, { path: "u/1/cv", name: "cv", size: 10 }),
    ).toEqual(["file_type_not_allowed"]);
  });

  it("reports size and type problems together", () => {
    expect(
      codes(question, { path: "u/1/cv.png", name: "cv.png", size: 9999 }),
    ).toEqual(["file_too_large", "file_type_not_allowed"]);
  });

  it("honours a wildcard subtype", () => {
    const images = makeQuestion("file_upload", {
      config: { allowedMimeTypes: ["image/*"], maxBytes: 1000 },
    });
    expect(
      validateAnswer(images, { path: "a/b.png", name: "b.png", size: 1 })
        .success,
    ).toBe(true);
    expect(codes(images, { path: "a/b.pdf", name: "b.pdf", size: 1 })).toEqual([
      "file_type_not_allowed",
    ]);
  });

  it("applies the ten megabyte default when no config is stored", () => {
    const defaults = makeQuestion("file_upload", { config: null });
    expect(
      codes(defaults, {
        path: "u/1/cv.pdf",
        name: "cv.pdf",
        size: 10_485_761,
      }),
    ).toEqual(["file_too_large"]);
  });
});

describe("misconfigured questions", () => {
  it("fails loudly instead of validating against a broken config", () => {
    const question = makeQuestion("linear_scale", {
      required: true,
      config: { min: 9, max: 2 },
    });
    const result = validateAnswer(question, 5);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map((error) => error.code)).toEqual([
        "invalid_config",
      ]);
    }
  });

  it("fails on an unknown config key rather than ignoring it", () => {
    const question = makeQuestion("short_answer", {
      config: { maxLenght: 10 },
    });
    expect(codes(question, "anything")).toEqual(["invalid_config"]);
  });
});

describe("validateAnswers", () => {
  const name = makeQuestion("short_answer", { id: "q-name", required: true });
  const school = makeChoiceQuestion("dropdown", ["gmu", "vt"], {
    id: "q-school",
    required: true,
  });
  const notes = makeQuestion("paragraph", { id: "q-notes", required: false });

  it("returns parsed answers when everything checks out", () => {
    const result = validateAnswers([name, school, notes], {
      "q-name": "Ada",
      "q-school": "gmu",
    });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.answers).toEqual({
      "q-name": { type: "short_answer", value: "Ada" },
      "q-school": { type: "dropdown", value: "gmu" },
      "q-notes": null,
    });
  });

  it("collects errors from every question rather than stopping at the first", () => {
    const result = validateAnswers([name, school, notes], {
      "q-school": "mit",
      "q-notes": 12,
    });
    expect(result.success).toBe(false);
    expect(
      result.errors.map((error) => [error.questionId, error.code]),
    ).toEqual([
      ["q-name", "required"],
      ["q-school", "unknown_option"],
      ["q-notes", "invalid_value"],
    ]);
  });

  it("ignores values for questions it was not given", () => {
    const result = validateAnswers([notes], {
      "q-notes": "fine",
      "q-unreachable": "should be ignored",
    });
    expect(result.success).toBe(true);
    expect(Object.keys(result.answers)).toEqual(["q-notes"]);
  });
});
