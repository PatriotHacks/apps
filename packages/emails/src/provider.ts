import { Resend } from "resend";

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * The seam between rendering and the network. `sendTemplateEmail` takes one of
 * these, so the send path is exercised without a live provider.
 */
export type EmailProvider = {
  /** Resolves with the provider's message id, or throws with a usable reason. */
  send(message: OutboundEmail): Promise<{ id: string }>;
};

/**
 * The Resend SDK reports failures as `{ data: null, error }` rather than
 * throwing, so both shapes are normalised into one rejection here and the
 * caller only has to handle a thrown error.
 */
export function createResendProvider(apiKey: string, from: string): EmailProvider {
  const resend = new Resend(apiKey);

  return {
    async send({ to, subject, html, text }) {
      const { data, error } = await resend.emails.send({ from, to, subject, html, text });
      if (error) throw new Error(`${error.name}: ${error.message}`);
      if (!data) throw new Error("Resend accepted the request but returned no message id");
      return { id: data.id };
    },
  };
}

/** Reads the provider configuration the app is deployed with. */
export function resendProviderFromEnv(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  return createResendProvider(apiKey, from);
}
