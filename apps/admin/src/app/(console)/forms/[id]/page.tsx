import { type Form } from "@patriothacks/database";
import { Badge, Button } from "@patriothacks/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatWindow } from "@/lib/format";
import { type FormDetail, getFormDetail } from "@/lib/forms";

const EDIT_POLICY: Record<Form["editPolicy"], string> = {
  locked: "Locked after submit",
  per_question: "Per question",
  full: "Fully editable after submit",
};

/** `short_answer` reads fine as `short answer`; a hand-kept label map would drift. */
const humanise = (value: string) => value.replaceAll("_", " ");

function branchTarget(
  action: "next" | "section" | "submit",
  sectionId: string | null,
  sectionNames: Record<string, string>,
) {
  if (action === "submit") return "Submit the form";
  if (action === "section" && sectionId) return sectionNames[sectionId] ?? "Unknown section";
  return null;
}

function ImmutabilityNotice({ status }: { status: Form["status"] }) {
  if (status === "draft") {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">Draft — structure is still editable</p>
        <p className="text-sm text-muted-foreground">
          Publishing is irreversible. Once this form is published its sections, questions and
          branching are frozen for good.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">
        {status === "published" ? "Published — locked forever" : "Closed — locked forever"}
      </p>
      <p className="text-sm text-destructive/90">
        This form has been published, so its structure is immutable. Sections, questions, options and
        branch targets can never be changed, reordered or deleted — not by an admin, not by support.
        Applicants have already answered against this exact shape. To ask something different, create
        a new form.
      </p>
    </div>
  );
}

function SectionCard({
  section,
  sectionNames,
}: {
  section: FormDetail["sections"][number];
  sectionNames: Record<string, string>;
}) {
  const sectionNext = branchTarget(section.nextAction, section.nextSectionId, sectionNames);

  return (
    <section className="rounded-lg border">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
        <div>
          <h2 className="font-medium">
            {section.position + 1}. {section.label}
          </h2>
          {section.description ? (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          After this section: {sectionNext ?? "continue to the next section"}
        </p>
      </header>

      <ol className="divide-y">
        {section.questions.map((question) => (
          <li key={question.id} className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{question.label}</span>
              <Badge variant="outline">{humanise(question.type)}</Badge>
              {question.required ? <Badge variant="secondary">required</Badge> : null}
              {question.editableAfterSubmit ? (
                <Badge variant="secondary">editable after submit</Badge>
              ) : null}
            </div>

            {question.helpText ? (
              <p className="text-sm text-muted-foreground">{question.helpText}</p>
            ) : null}

            {question.options.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm">
                {question.options.map((option) => {
                  const target = branchTarget(option.nextAction, option.nextSectionId, sectionNames);
                  return (
                    <li key={option.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">
                        {option.kind === "choice" ? "•" : `${humanise(option.kind)}:`} {option.label}
                      </span>
                      {target ? (
                        <span className="text-xs font-medium">jumps to {target}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        ))}

        {section.questions.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No questions in this section.</li>
        ) : null}
      </ol>
    </section>
  );
}

export default async function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getFormDetail(id);
  if (!detail) notFound();

  const { form, sections, sectionNames } = detail;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{form.title}</h1>
            <StatusBadge status={form.status} />
          </div>
          <p className="text-sm text-muted-foreground">/{form.slug}</p>
          {form.description ? <p className="text-sm">{form.description}</p> : null}
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/forms/${form.id}/submissions`}>Submissions</Link>
        </Button>
      </div>

      <ImmutabilityNotice status={form.status} />

      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Edit policy</dt>
          <dd>{EDIT_POLICY[form.editPolicy]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Window</dt>
          <dd>{formatWindow(form.opensAt, form.closesAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Published</dt>
          <dd>{formatDateTime(form.publishedAt)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <SectionCard key={section.id} section={section} sectionNames={sectionNames} />
        ))}
      </div>
    </div>
  );
}
