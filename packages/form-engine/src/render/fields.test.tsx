// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionField } from "./question-field";
import {
  CHOICE_VALUES,
  GRID_COLUMN_IDS,
  GRID_ROW_IDS,
  QUESTION_LABEL,
  questionOfType,
} from "./test-questions";

afterEach(cleanup);

describe("ShortAnswerField", () => {
  it("reflects the current value", () => {
    render(
      <QuestionField
        question={questionOfType("short_answer")}
        value="Ada"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("Ada");
  });

  it("reports the edited string", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("short_answer")}
        value="Ada"
        onChange={onChange}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), "!");

    expect(onChange).toHaveBeenCalledWith("Ada!");
  });

  it("caps typing at the configured maximum length", () => {
    render(
      <QuestionField
        question={questionOfType("short_answer", { config: { maxLength: 40 } })}
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox").getAttribute("maxlength")).toBe("40");
  });
});

describe("ParagraphField", () => {
  it("reflects the current value in a textarea", () => {
    render(
      <QuestionField
        question={questionOfType("paragraph")}
        value="Weekends only"
        onChange={vi.fn()}
      />,
    );

    const control = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(control.tagName).toBe("TEXTAREA");
    expect(control.value).toBe("Weekends only");
  });

  it("reports the edited string", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("paragraph")}
        value="Weekends"
        onChange={onChange}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), "!");

    expect(onChange).toHaveBeenCalledWith("Weekends!");
  });
});

describe("MultipleChoiceField", () => {
  it("renders one radio per option inside a named group", () => {
    render(
      <QuestionField
        question={questionOfType("multiple_choice")}
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: QUESTION_LABEL })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(CHOICE_VALUES.length);
  });

  it("reflects the selected option", () => {
    render(
      <QuestionField
        question={questionOfType("multiple_choice")}
        value="beta"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "beta" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("reports the option value that was picked", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("multiple_choice")}
        value={null}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "alpha" }));

    expect(onChange).toHaveBeenCalledWith("alpha");
  });
});

describe("CheckboxesField", () => {
  it("reflects the selected options", () => {
    render(
      <QuestionField
        question={questionOfType("checkboxes")}
        value={["beta"]}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "beta" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("checkbox", { name: "alpha" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("adds a ticked option in option order", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("checkboxes")}
        value={["beta"]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "alpha" }));

    expect(onChange).toHaveBeenCalledWith(["alpha", "beta"]);
  });

  it("drops an unticked option", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("checkboxes")}
        value={["alpha", "beta"]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "alpha" }));

    expect(onChange).toHaveBeenCalledWith(["beta"]);
  });
});

describe("DropdownField", () => {
  it("reflects the selected option", () => {
    render(
      <QuestionField
        question={questionOfType("dropdown")}
        value="beta"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: QUESTION_LABEL })
        .value,
    ).toBe("beta");
  });

  it("reports the option value that was picked", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("dropdown")}
        value={null}
        onChange={onChange}
      />,
    );

    await userEvent.selectOptions(screen.getByRole("combobox"), "beta");

    expect(onChange).toHaveBeenCalledWith("beta");
  });
});

describe("LinearScaleField", () => {
  const question = () =>
    questionOfType("linear_scale", {
      config: { min: 1, max: 5, minLabel: "Never", maxLabel: "Daily" },
    });

  it("renders one radio per point plus the end labels", () => {
    render(
      <QuestionField question={question()} value={null} onChange={vi.fn()} />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByText("Never")).toBeTruthy();
    expect(screen.getByText("Daily")).toBeTruthy();
  });

  it("reflects the selected point", () => {
    render(<QuestionField question={question()} value={3} onChange={vi.fn()} />);

    expect(
      screen.getByRole("radio", { name: "3" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("reports a number rather than the rendered string", async () => {
    const onChange = vi.fn();
    render(<QuestionField question={question()} value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "4" }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("renders no control when the scale config cannot be read", () => {
    render(
      <QuestionField
        question={questionOfType("linear_scale", { config: { min: 5, max: 1 } })}
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(QUESTION_LABEL)).toBeTruthy();
  });
});

describe("DateField", () => {
  it("reflects the current value and the configured bounds", () => {
    render(
      <QuestionField
        question={questionOfType("date", {
          config: { min: "2026-01-01", max: "2026-12-31" },
        })}
        value="2026-03-01"
        onChange={vi.fn()}
      />,
    );

    const control = screen.getByLabelText<HTMLInputElement>(QUESTION_LABEL);
    expect(control.type).toBe("date");
    expect(control.value).toBe("2026-03-01");
    expect(control.min).toBe("2026-01-01");
    expect(control.max).toBe("2026-12-31");
  });

  it("reports the picked date as an ISO string", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("date")}
        value=""
        onChange={onChange}
      />,
    );

    await userEvent.type(screen.getByLabelText(QUESTION_LABEL), "2026-04-02");

    expect(onChange).toHaveBeenCalledWith("2026-04-02");
  });
});

describe("TimeField", () => {
  it("reflects the current value", () => {
    render(
      <QuestionField
        question={questionOfType("time")}
        value="09:30"
        onChange={vi.fn()}
      />,
    );

    const control = screen.getByLabelText<HTMLInputElement>(QUESTION_LABEL);
    expect(control.type).toBe("time");
    expect(control.value).toBe("09:30");
  });

  it("reports the picked time", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("time")}
        value=""
        onChange={onChange}
      />,
    );

    await userEvent.type(screen.getByLabelText(QUESTION_LABEL), "14:00");

    expect(onChange).toHaveBeenCalledWith("14:00");
  });
});

describe("GridMultipleChoiceField", () => {
  it("gives every axis a header cell", () => {
    render(
      <QuestionField
        question={questionOfType("grid_multiple_choice")}
        value={null}
        onChange={vi.fn()}
      />,
    );

    for (const rowId of GRID_ROW_IDS) {
      expect(screen.getByRole("rowheader", { name: rowId })).toBeTruthy();
    }
    for (const columnId of GRID_COLUMN_IDS) {
      expect(screen.getByRole("columnheader", { name: columnId })).toBeTruthy();
    }
  });

  it("names each cell after its row and column", () => {
    render(
      <QuestionField
        question={questionOfType("grid_multiple_choice")}
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "row-design column-no" }),
    ).toBeTruthy();
  });

  it("reflects the selected cell", () => {
    render(
      <QuestionField
        question={questionOfType("grid_multiple_choice")}
        value={{ "row-hardware": "column-yes" }}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole<HTMLInputElement>("radio", {
        name: "row-hardware column-yes",
      }).checked,
    ).toBe(true);
  });

  it("reports one column id per row id", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("grid_multiple_choice")}
        value={{ "row-hardware": "column-yes" }}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("radio", { name: "row-design column-no" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      "row-hardware": "column-yes",
      "row-design": "column-no",
    });
  });

  it("replaces the choice already made in a row", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("grid_multiple_choice")}
        value={{ "row-hardware": "column-yes" }}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("radio", { name: "row-hardware column-no" }),
    );

    expect(onChange).toHaveBeenCalledWith({ "row-hardware": "column-no" });
  });
});

describe("GridCheckboxField", () => {
  it("gives every axis a header cell", () => {
    render(
      <QuestionField
        question={questionOfType("grid_checkbox")}
        value={null}
        onChange={vi.fn()}
      />,
    );

    for (const rowId of GRID_ROW_IDS) {
      expect(screen.getByRole("rowheader", { name: rowId })).toBeTruthy();
    }
    for (const columnId of GRID_COLUMN_IDS) {
      expect(screen.getByRole("columnheader", { name: columnId })).toBeTruthy();
    }
  });

  it("reflects the selected cells", () => {
    render(
      <QuestionField
        question={questionOfType("grid_checkbox")}
        value={{ "row-hardware": ["column-yes"] }}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: "row-hardware column-yes",
      }).checked,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: "row-hardware column-no",
      }).checked,
    ).toBe(false);
  });

  it("reports many column ids per row id, in column order", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("grid_checkbox")}
        value={{ "row-hardware": ["column-no"] }}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("checkbox", { name: "row-hardware column-yes" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      "row-hardware": ["column-yes", "column-no"],
    });
  });

  it("empties a row when its last cell is unticked", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={questionOfType("grid_checkbox")}
        value={{ "row-hardware": ["column-yes"] }}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("checkbox", { name: "row-hardware column-yes" }),
    );

    expect(onChange).toHaveBeenCalledWith({ "row-hardware": [] });
  });
});

describe("FileUploadField", () => {
  const pdfQuestion = (config: Record<string, unknown> = {}) =>
    questionOfType("file_upload", {
      config: { allowedMimeTypes: ["application/pdf"], ...config },
    });

  function pdf(name: string, bytes: number): File {
    return new File(["x".repeat(bytes)], name, { type: "application/pdf" });
  }

  it("reports the file metadata with a placeholder path", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={pdfQuestion()}
        value={null}
        onChange={onChange}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText(QUESTION_LABEL),
      pdf("resume.pdf", 12),
    );

    expect(onChange).toHaveBeenCalledWith({
      path: "pending/resume.pdf",
      name: "resume.pdf",
      size: 12,
    });
  });

  it("shows the name and size of the file already chosen", () => {
    render(
      <QuestionField
        question={pdfQuestion()}
        value={{ path: "pending/resume.pdf", name: "resume.pdf", size: 2048 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("resume.pdf (2 KB)")).toBeTruthy();
  });

  it("refuses a file over the configured size limit", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={pdfQuestion({ maxBytes: 8 })}
        value={null}
        onChange={onChange}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText(QUESTION_LABEL),
      pdf("resume.pdf", 12),
    );

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("alert").textContent).toContain("The limit is");
  });

  it("refuses a file whose type is not allowed", async () => {
    const onChange = vi.fn();
    render(
      <QuestionField
        question={pdfQuestion()}
        value={null}
        onChange={onChange}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText(QUESTION_LABEL),
      pdf("resume.docx", 12),
    );

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("alert").textContent).toContain(
      "Allowed file types: application/pdf",
    );
  });

  it("limits the file picker to the allowed types", () => {
    render(
      <QuestionField
        question={pdfQuestion()}
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText(QUESTION_LABEL).getAttribute("accept"),
    ).toBe("application/pdf");
  });
});
