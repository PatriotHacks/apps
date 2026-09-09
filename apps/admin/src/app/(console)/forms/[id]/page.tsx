import { type Form } from "@patriothacks/database";
import { Badge, Button } from "@patriothacks/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { requireStaff } from "@/lib/auth";
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

function StatusNotice({ status }: { status: Form["status"] }) {
  if (status === "draft") {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">Draft — nobody can see this yet</p>
        <p className="text-sm text-muted-foreground">
          Publishing puts it in front of applicants. It stays editable afterwards.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium">
        {status === "published" ? "Published — applicants can fill this in" : "Closed"}
      </p>
      <p className="text-sm text-muted-foreground">
        Still editable. Answers already given are kept — rewording, reordering, adding questions and
        changing branch targets all leave them untouched. Only deleting a question, or switching one
        to a type that cannot read its answers, destroys anything, and the builder names how many
        before it does.
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
  const [staff, detail] = await Promise.all([requireStaff(), getFormDetail(id)]);
  if (!detail) notFound();

  const { form, sections, sectionNames } = detail;
  const editable = staff.role === "admin";

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

        <div className="flex gap-2">
          {editable ? (
            <Button asChild size="sm">
              <Link href={`/forms/${form.id}/edit`}>Edit</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/submissions/${form.id}`}>Submissions</Link>
          </Button>
        </div>
      </div>

      <StatusNotice status={form.status} />

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
