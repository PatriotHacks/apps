import { headers } from "next/headers";

/**
 * The unsubscribe link has to work for someone who cannot sign in — a stale
 * address, a lost password, a forwarded email. So the link carries its own
 * proof: `<user id>.<HMAC of that id>`. Without the signature the route would
 * be "unsubscribe anyone whose uuid you can guess", and uuids leak.
 *
 * The secret is what makes the token unforgeable, so a missing one is a hard
 * failure rather than a fallback to an unsigned link.
 */
function secret(): string {
  const value = process.env.UNSUBSCRIBE_SECRET;
  if (!value) throw new Error("UNSUBSCRIBE_SECRET is not set");
  return value;
}

const encoder = new TextEncoder();

function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const toBase64Url = (bytes: ArrayBuffer): string =>
  Buffer.from(bytes).toString("base64url");

export async function signUnsubscribeToken(userId: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(userId));
  return `${userId}.${toBase64Url(signature)}`;
}

/** The signed user id, or null for anything that does not verify. */
export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = token.slice(0, separator);
  const signature = Buffer.from(token.slice(separator + 1), "base64url");

  // `crypto.subtle.verify` compares in constant time, so a wrong signature
  // leaks no information about how nearly right it was.
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    signature,
    encoder.encode(userId),
  );

  return valid ? userId : null;
}

/**
 * Built from the request's own host rather than a configured base URL: the
 * console is reached on one origin in production and another in development,
 * and a link that points at the wrong one is a dead unsubscribe.
 */
export async function unsubscribeUrlFor(userId: string): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) throw new Error("Request has no Host header, so no unsubscribe link can be built");

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const token = await signUnsubscribeToken(userId);

  return `${protocol}://${host}/unsubscribe?token=${encodeURIComponent(token)}`;
}
