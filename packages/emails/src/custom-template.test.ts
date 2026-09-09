import { describe, expect, it } from "vitest";

import { interpolate, unknownVariables } from "./interpolate.ts";
import { compileNewsletter, type NewsletterBlock } from "./newsletter.ts";
import { renderTemplate } from "./render.ts";
import {
  customTemplateKey,
  isCustomTemplateKey,
  isTemplateKey,
  sampleContext,
  variablesFor,
  BROADCAST_VARIABLES,
} from "./templates.ts";

const key = customTemplateKey("Mentor welcome")!;

const blocks: NewsletterBlock[] = [
  { type: "heading", text: "Welcome", level: 2 },
  { type: "text", text: "Hi {{full_name}}, thanks for mentoring at PatriotHacks {{year}}." },
];

describe("customTemplateKey", () => {
  it("slugs the label and prefixes it out of the catalogue's namespace", () => {
    expect(customTemplateKey("Mentor welcome")).toBe("custom_mentor_welcome");
    expect(customTemplateKey("  Check-in — Friday!  ")).toBe("custom_check_in_friday");
  });

  it("is null when the label has nothing to slug", () => {
    expect(customTemplateKey("!!!")).toBeNull();
    expect(customTemplateKey("")).toBeNull();
  });

  it("mints a key the catalogue does not claim", () => {
    expect(isTemplateKey(key)).toBe(false);
    expect(isCustomTemplateKey(key)).toBe(true);
    expect(isCustomTemplateKey("decision_accepted")).toBe(false);
  });
});

describe("a custom template's variables", () => {
  it("resolves to the broadcast set, so a broadcast can always fill them", () => {
    expect(variablesFor(key)).toEqual([...BROADCAST_VARIABLES]);
    expect(Object.keys(sampleContext(key))).toEqual([...BROADCAST_VARIABLES]);
  });

  it("accepts all four of them", () => {
    const sources = BROADCAST_VARIABLES.map((name) => `{{${name}}}`);
    expect(unknownVariables(key, ...sources)).toEqual([]);
  });

  it("rejects a variable only a decision email has", () => {
    expect(unknownVariables(key, "RSVP at {{rsvp_url}}")).toEqual(["rsvp_url"]);
    expect(unknownVariables(key, "<p>Your application to {{form_title}}</p>")).toEqual([
      "form_title",
    ]);
  });
});

describe("a compiled custom body", () => {
  it("leaves its placeholders intact for interpolation at send time", () => {
    const { html, text } = compileNewsletter(blocks);

    expect(html).toContain("{{full_name}}");
    expect(text).toContain("{{full_name}}");
    expect(unknownVariables(key, html, text)).toEqual([]);

    const context = sampleContext(key);
    expect(interpolate(html, context)).toContain("Hi Ada Admin, thanks for mentoring");
    expect(interpolate(html, context)).not.toContain("{{");
  });

  it("renders through the shared layout with the sample values filled in", async () => {
    const { html, text } = compileNewsletter(blocks);
    const context = sampleContext(key);

    const email = await renderTemplate(
      { key, subject: "Welcome, {{full_name}}", bodyHtml: html, bodyText: text },
      context,
      context.unsubscribe_url,
    );

    expect(email.subject).toBe("Welcome, Ada Admin");
    expect(email.html).toContain("<!DOCTYPE html");
    expect(email.html).toContain("Hi Ada Admin, thanks for mentoring");
    expect(email.html).not.toContain("{{");
    expect(email.text).not.toContain("{{");
  });
});
