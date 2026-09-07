import type { Form } from "@patriothacks/database";

/**
 * The standing notice on a published form.
 *
 * Not a toast, on purpose. A toast appears after an edit and disappears before
 * the next one, which is exactly backwards: the risk is constant for as long as
 * the form is live, so the warning is part of the page and stays on screen the
 * whole time the builder is open.
 *
 * It names the two consequences that are not recoverable and not obvious, and
 * says them plainly rather than in the abstract. Deleting is destructive in the
 * ordinary sense. Rewording is the subtler one — nothing errors, nothing is
 * lost, and every answer already given now sits under a question that asked
 * something else.
 */
export function LiveFormWarning({
  status,
  submissionCount,
}: {
  status: Form["status"];
  submissionCount: number;
}) {
  if (status === "draft") return null;

  const answered =
    submissionCount === 0
      ? "No one has submitted it yet, but it is open and someone can start at any moment."
      : `${submissionCount} ${submissionCount === 1 ? "person has" : "people have"} already submitted it.`;

  return (
    <section
      aria-label="Editing a live form"
      className="flex flex-col gap-2 rounded-lg border border-l-4 border-border border-l-destructive bg-muted/50 p-4"
    >
      <h2 className="text-sm font-semibold text-destructive">
        You are editing a form that is live
      </h2>
      <p className="text-sm text-muted-foreground">
        {answered} Every change below takes effect immediately, including for someone part-way
        through filling it in.
      </p>

      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Deleting a question deletes its answers.</span>{" "}
          Every response anyone has given to it goes with it. It is kept in the revision history for
          audit and never appears in the console or an export again.
        </li>
        <li>
          <span className="font-medium text-foreground">
            Rewording a question does not reword the answers already given.
          </span>{" "}
          They stay exactly as they were and are shown under the new wording, so a question edited
          into meaning something else silently changes what past answers appear to say.
        </li>
      </ul>
    </section>
  );
}
