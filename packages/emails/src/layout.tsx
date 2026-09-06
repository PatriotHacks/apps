import { Body, Container, Head, Hr, Html, Section, Text, render } from "react-email";

/**
 * The shell every transactional email is poured into: header, footer and the
 * only styling in the system. The copy lives in `email_templates` — organizers
 * own the words, this package owns the rendering.
 */

const BRAND = "PatriotHacks";
const SUPPORT_EMAIL = "hello@patriothacks.org";

const body = {
  backgroundColor: "#f5f5f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "24px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e5e5",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px",
};

const heading = {
  color: "#0a2240",
  fontSize: "20px",
  fontWeight: "700",
  letterSpacing: "-0.01em",
  margin: "0 0 24px",
};

const content = {
  color: "#1f2933",
  fontSize: "15px",
  lineHeight: "24px",
};

const rule = { borderColor: "#e5e5e5", margin: "28px 0 16px" };

const footer = { color: "#6b7280", fontSize: "12px", lineHeight: "18px", margin: "0" };

export function EmailLayout({ bodyHtml }: { bodyHtml: string }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>{BRAND}</Text>

          {/* Admin-authored markup from `email_templates`, with every
              interpolated value already HTML-escaped by the renderer. Section
              renders its own table cell, so the raw body goes in a child. */}
          <Section>
            <div style={content} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          <Hr style={rule} />
          <Text style={footer}>
            {BRAND} · George Mason University · Questions? {SUPPORT_EMAIL}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** The plain text counterpart of the shell above. */
export function wrapText(bodyText: string): string {
  return `${bodyText.trim()}\n\n—\n${BRAND} · George Mason University\nQuestions? ${SUPPORT_EMAIL}\n`;
}

export function renderLayout(bodyHtml: string): Promise<string> {
  return render(<EmailLayout bodyHtml={bodyHtml} />);
}
