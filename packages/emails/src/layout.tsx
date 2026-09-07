import { Body, Container, Head, Hr, Html, Link, Section, Text, render } from "react-email";

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

const unsubscribeLink = { color: "#6b7280", textDecoration: "underline" };

/**
 * `unsubscribeUrl` is supplied for broadcasts and omitted for transactional
 * mail. The link lives in the shell rather than in the authored body so a
 * broadcast cannot ship without one — forgetting it is not an option an author
 * has. Transactional decision and RSVP notices are owed to the applicant
 * regardless of their broadcast preference, so they carry no link at all.
 */
export function EmailLayout({
  bodyHtml,
  unsubscribeUrl,
}: {
  bodyHtml: string;
  unsubscribeUrl?: string | undefined;
}) {
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
          {unsubscribeUrl ? (
            <Text style={footer}>
              <Link href={unsubscribeUrl} style={unsubscribeLink}>
                Unsubscribe from announcements
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

/** The plain text counterpart of the shell above. */
export function wrapText(bodyText: string, unsubscribeUrl?: string): string {
  const tail = unsubscribeUrl ? `Unsubscribe from announcements: ${unsubscribeUrl}\n` : "";
  return `${bodyText.trim()}\n\n—\n${BRAND} · George Mason University\nQuestions? ${SUPPORT_EMAIL}\n${tail}`;
}

export function renderLayout(bodyHtml: string, unsubscribeUrl?: string): Promise<string> {
  return render(<EmailLayout bodyHtml={bodyHtml} unsubscribeUrl={unsubscribeUrl} />);
}
