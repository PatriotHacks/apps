import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOWED_MIME_TYPES,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_SCALE_MAX,
  DEFAULT_SCALE_MIN,
} from "./config-schemas";
import { parseQuestionConfig } from "./parse";
import { QUESTION_TYPES } from "./types";

describe("question config", () => {
  it.each(QUESTION_TYPES)("treats a null %s config as empty", (type) => {
    expect(parseQuestionConfig(type, null).success).toBe(true);
    expect(parseQuestionConfig(type, undefined).success).toBe(true);
    expect(parseQuestionConfig(type, {}).success).toBe(true);
  });

  it.each(QUESTION_TYPES)("rejects an unknown key on %s", (type) => {
    const result = parseQuestionConfig(type, { notARealSetting: true });
    expect(result.success).toBe(false);
  });

  it.each(QUESTION_TYPES)("rejects a non-object %s config", (type) => {
    expect(parseQuestionConfig(type, "min:1").success).toBe(false);
    expect(parseQuestionConfig(type, 5).success).toBe(false);
  });
});

describe("text config", () => {
  it("accepts lengths and a pattern", () => {
    const result = parseQuestionConfig("short_answer", {
      minLength: 2,
      maxLength: 80,
      pattern: "^[A-Z]",
    });
    expect(result).toEqual({
      success: true,
      data: { minLength: 2, maxLength: 80, pattern: "^[A-Z]" },
    });
  });

  it("rejects a min longer than the max", () => {
    const result = parseQuestionConfig("paragraph", {
      minLength: 500,
      maxLength: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]?.message).toContain("minLength");
    }
  });

  it("rejects a pattern that is not a valid regular expression", () => {
    expect(
      parseQuestionConfig("short_answer", { pattern: "([a-z" }).success,
    ).toBe(false);
  });

  it("rejects negative and fractional lengths", () => {
    expect(
      parseQuestionConfig("short_answer", { minLength: -1 }).success,
    ).toBe(false);
    expect(
      parseQuestionConfig("short_answer", { maxLength: 0 }).success,
    ).toBe(false);
    expect(
      parseQuestionConfig("short_answer", { maxLength: 10.5 }).success,
    ).toBe(false);
  });
});

describe("linear scale config", () => {
  it("defaults to a one to five scale", () => {
    expect(parseQuestionConfig("linear_scale", {})).toEqual({
      success: true,
      data: { min: DEFAULT_SCALE_MIN, max: DEFAULT_SCALE_MAX },
    });
  });

  it("accepts explicit bounds and endpoint labels", () => {
    const result = parseQuestionConfig("linear_scale", {
      min: 0,
      max: 10,
      minLabel: "Never",
      maxLabel: "Always",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a min that is not below the max", () => {
    expect(
      parseQuestionConfig("linear_scale", { min: 5, max: 1 }).success,
    ).toBe(false);
    expect(
      parseQuestionConfig("linear_scale", { min: 3, max: 3 }).success,
    ).toBe(false);
  });

  it("rejects fractional bounds", () => {
    expect(
      parseQuestionConfig("linear_scale", { min: 1, max: 5.5 }).success,
    ).toBe(false);
  });
});

describe("file upload config", () => {
  it("defaults to a ten megabyte PDF", () => {
    expect(parseQuestionConfig("file_upload", {})).toEqual({
      success: true,
      data: {
        allowedMimeTypes: [...DEFAULT_ALLOWED_MIME_TYPES],
        maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
      },
    });
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(10485760);
  });

  it("rejects an empty allow list", () => {
    expect(
      parseQuestionConfig("file_upload", { allowedMimeTypes: [] }).success,
    ).toBe(false);
  });

  it("rejects a non-positive size cap", () => {
    expect(parseQuestionConfig("file_upload", { maxBytes: 0 }).success).toBe(
      false,
    );
    expect(
      parseQuestionConfig("file_upload", { maxBytes: -1 }).success,
    ).toBe(false);
  });
});

describe("date and time config", () => {
  it("accepts an ordered range", () => {
    expect(
      parseQuestionConfig("date", { min: "2026-01-01", max: "2026-12-31" })
        .success,
    ).toBe(true);
    expect(
      parseQuestionConfig("time", { min: "09:00", max: "17:00" }).success,
    ).toBe(true);
  });

  it("rejects a reversed range", () => {
    expect(
      parseQuestionConfig("date", { min: "2026-12-31", max: "2026-01-01" })
        .success,
    ).toBe(false);
    expect(
      parseQuestionConfig("time", { min: "17:00", max: "09:00" }).success,
    ).toBe(false);
  });

  it("rejects bounds that are not real dates or times", () => {
    expect(parseQuestionConfig("date", { min: "2026-02-30" }).success).toBe(
      false,
    );
    expect(parseQuestionConfig("time", { max: "24:00" }).success).toBe(false);
  });
});
