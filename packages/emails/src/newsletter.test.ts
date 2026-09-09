import { describe, expect, it } from "vitest";

import { interpolate } from "./interpolate.ts";
import {
  compileNewsletter,
  parseNewsletterBlocks,
  type NewsletterBlock,
} from "./newsletter.ts";
import { BROADCAST_KEY, sampleContext } from "./templates.ts";

const compile = (blocks: NewsletterBlock[]) => compileNewsletter(blocks);

/** Parsed rather than cast, so the fixtures prove the schema accepts them. */
function parsed(input: unknown): NewsletterBlock[] {
  const result = parseNewsletterBlocks(input);
  if (!result.ok) throw new Error(result.message);
  return result.blocks;
}

describe("compileNewsletter html", () => {
  it("renders a heading at the level it declares", () => {
    const { html } = compile([{ type: "heading", text: "Check-in opens Friday", level: 2 }]);

    expect(html).toContain("<h2");
    expect(html).toContain("Check-in opens Friday</h2>");
    expect(html).toContain("font-size:20px");
  });

  it("renders a paragraph with inline styles and no stylesheet", () => {
    const { html } = compile([{ type: "text", text: "Doors open at 5pm." }]);

    expect(html).toBe(
      '<p style="color:#1f2933;font-size:15px;line-height:24px;margin:0 0 16px">Doors open at 5pm.</p>',
    );
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
  });

  it("renders an image, and wraps it in an anchor when it links somewhere", () => {
    const plain = compile([
      { type: "image", url: "https://cdn.example.com/hero.png", alt: "The venue" },
    ]);

    expect(plain.html).toContain('<img src="https://cdn.example.com/hero.png" alt="The venue"');
    expect(plain.html).toContain("max-width:100%");
    expect(plain.html).not.toContain("<a ");

    const linked = compile([
      {
        type: "image",
        url: "https://cdn.example.com/hero.png",
        alt: "The venue",
        href: "https://patriothacks.org",
      },
    ]);

    expect(linked.html).toContain('<a href="https://patriothacks.org"><img');
  });

  it("renders a button as a table cell with a padded anchor", () => {
    const { html } = compile([
      { type: "button", label: "RSVP now", url: "https://patriothacks.org/rsvp" },
    ]);

    expect(html).toContain("<table");
    expect(html).toContain("background-color:#0a2240");
    expect(html).toContain('<a href="https://patriothacks.org/rsvp"');
    expect(html).toContain("padding:12px 20px");
    expect(html).toContain("RSVP now</a>");
    expect(html).not.toContain("<button");
  });

  it("renders a divider as a rule", () => {
    const { html } = compile([{ type: "divider" }]);

    expect(html).toBe('<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />');
  });

  it("emits body-level html only, with no layout of its own", () => {
    const { html } = compile([
      { type: "heading", text: "Update", level: 1 },
      { type: "text", text: "Body." },
    ]);

    expect(html).not.toContain("<!DOCTYPE");
    expect(html).not.toContain("<html");
    expect(html).not.toContain("<body");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("display:grid");
    expect(html).not.toContain("<link");
  });
});

describe("compileNewsletter text", () => {
  it("gives every block a plain text counterpart", () => {
    const { text } = compile([
      { type: "heading", text: "Check-in opens Friday", level: 2 },
      { type: "text", text: "Doors open at 5pm." },
      { type: "image", url: "https://cdn.example.com/hero.png", alt: "The venue at dusk" },
      { type: "button", label: "RSVP now", url: "https://patriothacks.org/rsvp" },
      { type: "divider" },
    ]);

    expect(text).toBe(
      [
        "Check-in opens Friday",
        "Doors open at 5pm.",
        "The venue at dusk",
        "RSVP now (https://patriothacks.org/rsvp)",
        "----------------------------------------",
      ].join("\n\n"),
    );
  });

  it("writes an inline link as label followed by the url", () => {
    const { text } = compile([
      { type: "text", text: "Read the [schedule](https://patriothacks.org/schedule) first." },
    ]);

    expect(text).toBe("Read the schedule (https://patriothacks.org/schedule) first.");
  });

  it("adds no markup and escapes nothing, because it is not markup", () => {
    const { text } = compile([
      { type: "heading", text: "Update", level: 1 },
      { type: "text", text: "Tabs & Spaces <b>." },
    ]);

    expect(text).toBe("Update\n\nTabs & Spaces <b>.");
    expect(text).not.toContain("&amp;");
    expect(text).not.toContain("&lt;");
    expect(text).not.toContain("<p");
    expect(text).not.toContain("<h1");
  });
});

describe("inline links", () => {
  it("turns [label](url) into an anchor with the label escaped", () => {
    const { html } = compile([
      { type: "text", text: "Read the [<schedule>](https://patriothacks.org/s?a=1&b=2) first." },
    ]);

    expect(html).toContain('<a href="https://patriothacks.org/s?a=1&amp;b=2"');
    expect(html).toContain("&lt;schedule&gt;</a>");
    expect(html).toContain("Read the ");
    expect(html).toContain(" first.");
  });

  it("leaves a link whose url is not http or https as literal text", () => {
    const { html } = compile([
      { type: "text", text: "Careful: [click me](javascript:alert(1)) and [also](data:text/html,x)." },
    ]);

    // The scheme survives as inert text inside the paragraph, which is the
    // point: nothing becomes an href, and the author can see their mistake.
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
    expect(html).toContain("[click me](javascript:alert(1))");
    expect(html).toContain("[also](data:text/html,x)");
  });

  it("leaves malformed link syntax alone rather than corrupting the output", () => {
    const cases = [
      "A stray [ bracket.",
      "An unclosed [label](https://patriothacks.org",
      "Brackets [with] no url.",
      "Parens (https://patriothacks.org) with no label.",
      "Empty ]( pair.",
    ];

    for (const source of cases) {
      const { html, text } = compile([{ type: "text", text: source }]);
      expect(html).not.toContain("<a ");
      expect(text).toBe(source);
    }
  });

  it("renders several links in one paragraph", () => {
    const { html } = compile([
      {
        type: "text",
        text: "See [one](https://patriothacks.org/1) and [two](https://patriothacks.org/2).",
      },
    ]);

    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain(">one</a>");
    expect(html).toContain(">two</a>");
  });
});

describe("escaping", () => {
  it("escapes author text before it reaches the html document", () => {
    const { html } = compile([
      { type: "heading", text: '<script>alert("xss")</script>', level: 1 },
      { type: "text", text: "Tabs & Spaces <b>bold</b>." },
      { type: "button", label: '"Go" & <go>', url: "https://patriothacks.org" },
      { type: "image", url: "https://cdn.example.com/a.png", alt: 'A "photo" & <thing>' },
    ]);

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).toContain("Tabs &amp; Spaces &lt;b&gt;bold&lt;/b&gt;.");
    expect(html).toContain("&quot;Go&quot; &amp; &lt;go&gt;</a>");
    expect(html).toContain('alt="A &quot;photo&quot; &amp; &lt;thing&gt;"');
  });

  it("leaves a {{variable}} intact so interpolation can still fill it at send time", () => {
    const { html, text } = compile([
      { type: "text", text: "Hi {{full_name}}, doors open at 5pm." },
      { type: "button", label: "RSVP, {{full_name}}", url: "https://patriothacks.org/rsvp" },
    ]);

    expect(html).toContain("Hi {{full_name}}, doors open at 5pm.");
    expect(html).toContain("RSVP, {{full_name}}</a>");
    expect(text).toContain("Hi {{full_name}}");

    const context = sampleContext(BROADCAST_KEY);

    expect(interpolate(html, context)).toContain("Hi Ada Admin, doors open at 5pm.");
    expect(interpolate(html, context)).not.toContain("{{");
    expect(interpolate(text, context)).toContain("Hi Ada Admin");
  });
});

describe("parseNewsletterBlocks", () => {
  it("accepts every block type", () => {
    const blocks = parsed([
      { type: "heading", text: "Update", level: 3 },
      { type: "text", text: "Body." },
      { type: "image", url: "https://cdn.example.com/a.png", alt: "A photo" },
      { type: "button", label: "RSVP", url: "https://patriothacks.org/rsvp" },
      { type: "divider" },
    ]);

    expect(blocks).toHaveLength(5);
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "text",
      "image",
      "button",
      "divider",
    ]);
  });

  it("rejects a url that is not http or https", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "mailto:hello@patriothacks.org",
      "patriothacks.org",
      "",
    ]) {
      const result = parseNewsletterBlocks([{ type: "button", label: "Go", url }]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("http://");
    }
  });

  it("rejects a link target that is not http or https", () => {
    const result = parseNewsletterBlocks([
      { type: "image", url: "https://cdn.example.com/a.png", alt: "A", href: "javascript:x" },
    ]);

    expect(result.ok).toBe(false);
  });

  it("names the block a problem is in", () => {
    const result = parseNewsletterBlocks([
      { type: "divider" },
      { type: "heading", text: "", level: 2 },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Block 2 text: A heading needs text");
  });

  it("rejects an unknown block type, an unknown field and an out of range heading level", () => {
    expect(parseNewsletterBlocks([{ type: "video", url: "https://a.example" }]).ok).toBe(false);
    expect(parseNewsletterBlocks([{ type: "divider", height: 4 }]).ok).toBe(false);
    expect(parseNewsletterBlocks([{ type: "heading", text: "Hi", level: 4 }]).ok).toBe(false);
    expect(parseNewsletterBlocks("not an array").ok).toBe(false);
  });

  it("accepts an empty list", () => {
    expect(parsed([])).toEqual([]);
  });
});

describe("an empty newsletter", () => {
  it("compiles to nothing rather than to an empty shell", () => {
    expect(compile([])).toEqual({ html: "", text: "" });
  });
});
