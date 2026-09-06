// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUESTION_TYPES } from "../types";
import { QUESTION_FIELD_COMPONENTS, QuestionField } from "./question-field";
import { QUESTION_LABEL, questionOfType } from "./test-questions";

afterEach(cleanup);

describe("QUESTION_FIELD_COMPONENTS", () => {
  it("has exactly one component per question type", () => {
    expect(Object.keys(QUESTION_FIELD_COMPONENTS).sort()).toEqual(
      [...QUESTION_TYPES].sort(),
    );
  });

  it("maps each type to a distinct component", () => {
    const components = Object.values(QUESTION_FIELD_COMPONENTS);
    expect(new Set(components).size).toBe(components.length);
  });
});

describe("QuestionField", () => {
  it.each(QUESTION_TYPES)("renders the label for %s", (type) => {
    render(
      <QuestionField
        question={questionOfType(type)}
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(QUESTION_LABEL)).toBeTruthy();
  });

  it.each(QUESTION_TYPES)("displays a passed-in error for %s", (type) => {
    render(
      <QuestionField
        question={questionOfType(type)}
        value={null}
        onChange={vi.fn()}
        error="Please answer this question"
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "Please answer this question",
    );
  });

  it.each(QUESTION_TYPES)(
    "describes the %s control with its help text and error",
    (type) => {
      const question = questionOfType(type, {
        helpText: "Pick whatever fits best",
      });
      render(
        <QuestionField
          question={question}
          value={null}
          onChange={vi.fn()}
          error="Please answer this question"
        />,
      );

      const described = document.querySelector("[aria-describedby]");
      const ids = described?.getAttribute("aria-describedby")?.split(" ") ?? [];
      expect(ids).toEqual([
        `question-${question.id}-help`,
        `question-${question.id}-error`,
      ]);
      expect(
        ids.map((id) => document.getElementById(id)?.textContent),
      ).toEqual(["Pick whatever fits best", "Please answer this question"]);
    },
  );

  it.each(QUESTION_TYPES)("marks %s as required for a screen reader", (type) => {
    render(
      <QuestionField
        question={questionOfType(type, { required: true })}
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("(required)")).toBeTruthy();
  });

  it("renders no help text when the question has none", () => {
    const question = questionOfType("short_answer");
    render(
      <QuestionField question={question} value={null} onChange={vi.fn()} />,
    );

    expect(document.getElementById(`question-${question.id}-help`)).toBeNull();
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBeNull();
  });

  it("renders the component the question's type maps to", () => {
    render(
      <QuestionField
        question={questionOfType("paragraph")}
        value="Weekends only"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox").tagName).toBe("TEXTAREA");
  });
});
