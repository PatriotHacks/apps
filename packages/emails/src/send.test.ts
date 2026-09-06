import { type DatabaseTransaction, type NewEmailSend } from "@patriothacks/database";
import { describe, expect, it } from "vitest";

import { type EmailProvider } from "./provider.ts";
import { type StoredTemplate } from "./render.ts";
import { sendTemplateEmail } from "./send.ts";

const template: StoredTemplate<"decision_rejected"> = {
  key: "decision_rejected",
  subject: "PatriotHacks {{year}} application update",
  bodyHtml: "<p>Hi {{full_name}}, we couldn't offer you a spot at {{form_title}}.</p>",
  bodyText: "Hi {{full_name}}, we couldn't offer you a spot at {{form_title}}.",
};

const context = { full_name: "Ada Lovelace", form_title: "Hacker Application", year: "2026" };

/** Records what `sendTemplateEmail` would write, without a database. */
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

const failing: EmailProvider = {
  send: () => Promise.reject(new Error("validation_error: The domain is not verified")),
};

describe("sendTemplateEmail", () => {
  it("records a sent row carrying the provider message id", async () => {
    const { rows, tx } = recordingTx();

    const result = await sendTemplateEmail({
      tx,
      provider: succeeding,
      template,
      context,
      to: "ada@example.com",
      toUserId: "00000000-0000-0000-0000-0000000000a1",
    });

    expect(result).toEqual({ status: "sent", providerMessageId: "msg_stub_1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      templateKey: "decision_rejected",
      toEmail: "ada@example.com",
      toUserId: "00000000-0000-0000-0000-0000000000a1",
      subject: "PatriotHacks 2026 application update",
      status: "sent",
      providerMessageId: "msg_stub_1",
      error: null,
    });
    expect(rows[0]?.sentAt).toBeInstanceOf(Date);
  });

  it("still records a row when the provider rejects, carrying the reason", async () => {
    const { rows, tx } = recordingTx();

    const result = await sendTemplateEmail({
      tx,
      provider: failing,
      template,
      context,
      to: "not-an-address",
    });

    expect(result).toEqual({
      status: "failed",
      error: "validation_error: The domain is not verified",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      templateKey: "decision_rejected",
      toEmail: "not-an-address",
      subject: "PatriotHacks 2026 application update",
      status: "failed",
      providerMessageId: null,
      error: "validation_error: The domain is not verified",
      sentAt: null,
    });
  });

  it("does not swallow the provider failure into a thrown error", async () => {
    const { tx } = recordingTx();

    await expect(
      sendTemplateEmail({ tx, provider: failing, template, context, to: "ada@example.com" }),
    ).resolves.toMatchObject({ status: "failed" });
  });
});
