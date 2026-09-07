import { type DatabaseTransaction, type NewEmailSend } from "@patriothacks/database";
import { describe, expect, it } from "vitest";

import { unknownVariables } from "./interpolate.ts";
import { type EmailProvider } from "./provider.ts";
import { renderTemplate, type StoredTemplate } from "./render.ts";
import { sendTemplateEmail } from "./send.ts";
import { BROADCAST_KEY } from "./templates.ts";

const announcement: StoredTemplate<typeof BROADCAST_KEY> = {
  key: BROADCAST_KEY,
  subject: "PatriotHacks {{year}} — check-in opens Friday",
  bodyHtml: "<p>Hi {{full_name}}, check-in opens Friday at 5pm.</p>",
  bodyText: "Hi {{full_name}}, check-in opens Friday at 5pm.",
};

const context = {
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  year: "2026",
  unsubscribe_url: "https://admin.patriothacks.org/unsubscribe?token=t",
};

const UNSUBSCRIBE = "https://admin.patriothacks.org/unsubscribe?token=abc.def";

function recordingTx() {
  const rows: NewEmailSend[] = [];
  const tx = {
    insert: () => ({
      values: (row: NewEmailSend) => {
        rows.push(row);
        return Promise.resolve();
      },
    }),
  } as unknown as DatabaseTransaction;

  return { rows, tx };
}

const succeeding: EmailProvider = { send: () => Promise.resolve({ id: "msg_stub_1" }) };

describe("broadcast rendering", () => {
  it("interpolates a broadcast body through the shared renderer", async () => {
    const email = await renderTemplate(announcement, context);

    expect(email.subject).toBe("PatriotHacks 2026 — check-in opens Friday");
    expect(email.html).toContain("Hi Ada Lovelace, check-in opens Friday");
    expect(email.text).toContain("Hi Ada Lovelace, check-in opens Friday");
  });

  it("puts the unsubscribe link in the shell, not in the authored body", async () => {
    const email = await renderTemplate(announcement, context, UNSUBSCRIBE);

    expect(email.html).toContain(UNSUBSCRIBE);
    expect(email.html).toContain("Unsubscribe from announcements");
    expect(email.text).toContain(`Unsubscribe from announcements: ${UNSUBSCRIBE}`);
  });

  it("leaves transactional mail without an unsubscribe link", async () => {
    const email = await renderTemplate(announcement, context);

    expect(email.html).not.toContain("Unsubscribe from announcements");
    expect(email.text).not.toContain("Unsubscribe from announcements");
  });

  it("escapes an interpolated value in a broadcast body too", async () => {
    const email = await renderTemplate(announcement, {
      ...context,
      full_name: '<script>alert("xss")</script>',
    });

    expect(email.html).not.toContain("<script>alert");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("rejects a broadcast placeholder outside the broadcast variable list", () => {
    expect(
      unknownVariables(BROADCAST_KEY, "{{year}}", "<p>{{full_name}}</p>", "{{rsvp_url}}"),
    ).toEqual(["rsvp_url"]);
  });
});

describe("sendTemplateEmail for a broadcast", () => {
  it("records the broadcast id and no template key", async () => {
    const { rows, tx } = recordingTx();

    await sendTemplateEmail({
      tx,
      provider: succeeding,
      template: announcement,
      context,
      to: "ada@example.com",
      toUserId: "00000000-0000-0000-0000-0000000000a1",
      broadcastId: "55555555-5555-5555-5555-555555555555",
      unsubscribeUrl: UNSUBSCRIBE,
    });

    expect(rows[0]).toMatchObject({
      templateKey: null,
      broadcastId: "55555555-5555-5555-5555-555555555555",
      toEmail: "ada@example.com",
      subject: "PatriotHacks 2026 — check-in opens Friday",
      status: "sent",
    });
  });

  it("leaves broadcast_id null for a transactional send", async () => {
    const { rows, tx } = recordingTx();

    await sendTemplateEmail({
      tx,
      provider: succeeding,
      template: {
        key: "decision_rejected",
        subject: "PatriotHacks {{year}} application update",
        bodyHtml: "<p>Hi {{full_name}}.</p>",
        bodyText: "Hi {{full_name}}.",
      },
      context: { full_name: "Ada", form_title: "Hacker Application", year: "2026" },
      to: "ada@example.com",
    });

    expect(rows[0]).toMatchObject({ templateKey: "decision_rejected", broadcastId: null });
  });
});
