import { lookupUnsubscribe } from "./actions";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata = { title: "Unsubscribe · PatriotHacks" };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const lookup = token ? await lookupUnsubscribe(token) : ({ status: "invalid" } as const);

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">Announcement emails</h1>

      {lookup.status === "invalid" ? (
        <p className="text-sm text-muted-foreground">
          This unsubscribe link is not valid. It may have been truncated by your mail client — try
          copying the whole link from the email.
        </p>
      ) : (
        <UnsubscribeForm
          token={token!}
          email={lookup.email}
          alreadyUnsubscribed={lookup.alreadyUnsubscribed}
        />
      )}
    </main>
  );
}
