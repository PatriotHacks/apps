import { describe, expect, it } from "vitest";

import { UnknownVariableError, unknownVariables } from "./interpolate.ts";
import { renderTemplate, type StoredTemplate } from "./render.ts";
import { sampleContext } from "./templates.ts";

/** Mirrors the seeded `decision_accepted` row. */
const accepted: StoredTemplate<"decision_accepted"> = {
  key: "decision_accepted",
  subject: "You're in — PatriotHacks {{year}}",
  bodyHtml:
    "<p>Hi {{full_name}}, your application to {{form_title}} was accepted. RSVP at {{rsvp_url}}.</p>",
  bodyText:
    "Hi {{full_name}}, your application to {{form_title}} was accepted. RSVP at {{rsvp_url}}.",
};

const context = {
  full_name: "Ada Lovelace",
  form_title: "Hacker Application",
  year: "2026",
  rsvp_url: "https://patriothacks.org/rsvp/abc",
};

describe("renderTemplate", () => {
  it("interpolates the subject, the html body and the text body", async () => {
    const email = await renderTemplate(accepted, context);

    expect(email.subject).toBe("You're in — PatriotHacks 2026");
    expect(email.html).toContain(
      "Hi Ada Lovelace, your application to Hacker Application was accepted.",
    );
    expect(email.text).toContain(
      "Hi Ada Lovelace, your application to Hacker Application was accepted. RSVP at https://patriothacks.org/rsvp/abc.",
    );
    expect(email.html).not.toContain("{{");
    expect(email.text).not.toContain("{{");
  });

  it("wraps the body in the layout shell rather than shipping it bare", async () => {
    const email = await renderTemplate(accepted, context);

    expect(email.html).toContain("<!DOCTYPE html");
    expect(email.html).toContain("PatriotHacks");
    expect(email.html).toContain("hello@patriothacks.org");
    expect(email.text).toContain("hello@patriothacks.org");
  });

  it("escapes an interpolated value before it reaches the html document", async () => {
    const email = await renderTemplate(accepted, {
      ...context,
      full_name: '<script>alert("xss")</script>',
      form_title: "Tabs & Spaces <b>",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(email.html).toContain("Tabs &amp; Spaces &lt;b&gt;");
    // The template's own markup still renders; only the values are escaped.
    expect(email.html).toContain("<p>Hi &lt;script&gt;");
  });

  it("leaves the text body unescaped, because it is not markup", async () => {
    const email = await renderTemplate(accepted, { ...context, form_title: "Tabs & Spaces" });

    expect(email.text).toContain("Tabs & Spaces");
    expect(email.text).not.toContain("&amp;");
  });

  it("throws on a placeholder the key does not declare instead of rendering it", async () => {
    const rogue: StoredTemplate<"decision_accepted"> = {
      ...accepted,
      bodyHtml: "<p>Hi {{full_name}}, your score was {{reviewer_score}}.</p>",
    };

    await expect(renderTemplate(rogue, context)).rejects.toThrow(UnknownVariableError);
    await expect(renderTemplate(rogue, context)).rejects.toThrow(
      "Unknown template variable {{reviewer_score}}",
    );
  });

  it("renders every key from its own sample context", async () => {
    const rejected: StoredTemplate<"decision_rejected"> = {
      key: "decision_rejected",
      subject: "PatriotHacks {{year}} application update",
      bodyHtml: "<p>Hi {{full_name}}, we couldn't offer you a spot at {{form_title}}.</p>",
      bodyText: "Hi {{full_name}}, we couldn't offer you a spot at {{form_title}}.",
    };

    const email = await renderTemplate(rejected, sampleContext("decision_rejected"));
    expect(email.subject).toContain("application update");
    expect(email.html).toContain("Ada Admin");
  });
});

describe("unknownVariables", () => {
  it("reports placeholders the key does not declare", () => {
    expect(
      unknownVariables(
        "decision_rejected",
        "Subject {{year}}",
        "<p>{{full_name}} {{rsvp_url}}</p>",
        "{{reviewer_score}}",
      ),
    ).toEqual(["rsvp_url", "reviewer_score"]);
  });

  it("accepts a template that only uses declared variables", () => {
    expect(
      unknownVariables("decision_accepted", accepted.subject, accepted.bodyHtml, accepted.bodyText),
    ).toEqual([]);
  });
});
