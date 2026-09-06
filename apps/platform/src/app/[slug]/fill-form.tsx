"use client";

import type { Form, Submission } from "@patriothacks/database";
import {
  QuestionField,
  computeReachability,
  orphanedQuestionIds,
  parseAnswerValue,
  resolveNextSection,
  validateAnswers,
  type AnswerValueByType,
  type FormDefinition,
  type Question,
  type QuestionType,
  type ValidationError,
} from "@patriothacks/form-engine";
import { Button } from "@patriothacks/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { canEditQuestion } from "@/lib/editability";

import { saveAnswers, submitForm, type DiscardCandidate } from "./actions";

const AUTOSAVE_DELAY_MS = 800;

type SaveState = "idle" | "saving" | "saved" | "failed";

const SAVE_LABELS: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  failed: "Could not save",
};

/** The stored jsonb blob narrowed to what the renderer takes, or null. */
function fieldValue(
  question: Question,
  raw: unknown,
): AnswerValueByType[QuestionType] | null {
  if (raw === undefined || raw === null) return null;
  const parsed = parseAnswerValue(question.type, raw);
  return parsed.success ? parsed.data : null;
}

function firstErrorPerQuestion(errors: ValidationError[]): Record<string, string> {
  const byQuestion: Record<string, string> = {};
  for (const error of errors) {
    if (byQuestion[error.questionId] === undefined) byQuestion[error.questionId] = error.message;
  }
  return byQuestion;
}

export function FillForm({
  slug,
  definition,
  editPolicy,
  status,
  initialAnswers,
}: {
  slug: string;
  definition: FormDefinition;
  editPolicy: Form["editPolicy"];
  status: Submission["status"] | null;
  initialAnswers: Record<string, unknown>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [sectionId, setSectionId] = useState(() => definition.sections[0]?.id ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [discard, setDiscard] = useState<DiscardCandidate[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Refs rather than state: the debounce and the in-flight save read these
  // outside React's render cycle, and a stale closure would drop keystrokes.
  const pending = useRef<Record<string, unknown>>({});
  const confirmed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const held = useRef<{ questionId: string; value: unknown } | null>(null);

  const editing = status !== null && status !== "draft";

  const reachability = useMemo(
    () => computeReachability(definition, answers),
    [definition, answers],
  );
  const path = reachability.sections;
  const index = Math.max(
    0,
    path.findIndex((section) => section.id === sectionId),
  );
  const section = path[index];
  const atEnd = section
    ? resolveNextSection(definition, section.id, answers).kind === "submit"
    : true;

  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current !== null) await inFlight.current;
    const values = pending.current;
    if (Object.keys(values).length === 0) return;
    pending.current = {};

    setSaveState("saving");
    const run = saveAnswers(slug, values, confirmed.current);
    inFlight.current = run;
    try {
      const result = await run;
      if (result.status === "saved") {
        confirmed.current = false;
        setSaveState("saved");
        setNotice(null);
        return;
      }
      // Not saved: the values go back on the queue so a retry or the next
      // keystroke carries them, rather than vanishing with the failed call.
      pending.current = { ...values, ...pending.current };
      setSaveState("failed");
      if (result.status === "discard_required") {
        setDiscard(result.questions);
      } else {
        setNotice(result.message);
      }
    } catch {
      pending.current = { ...values, ...pending.current };
      setSaveState("failed");
      setNotice("Your answers could not be saved. Check your connection.");
    } finally {
      inFlight.current = null;
    }
  }, [slug]);

  const queue = useCallback(
    (questionId: string, value: unknown) => {
      pending.current[questionId] = value;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  const apply = useCallback(
    (questionId: string, value: unknown) => {
      setAnswers((current) => ({ ...current, [questionId]: value }));
      setErrors((current) => {
        if (current[questionId] === undefined) return current;
        const next = { ...current };
        delete next[questionId];
        return next;
      });
      queue(questionId, value);
    },
    [queue],
  );

  /**
   * Every answer change passes through here so a branch switch can be caught
   * before it destroys anything. The engine decides what is orphaned; the
   * change is held back until the applicant says the work can go.
   */
  const change = useCallback(
    (questionId: string, value: unknown) => {
      const next = { ...answers, [questionId]: value };
      const orphaned = orphanedQuestionIds(definition, answers, next);
      if (orphaned.length > 0) {
        const labels = new Map(
          definition.sections
            .flatMap((each) => each.questions)
            .map((question) => [question.id, question.label] as const),
        );
        setDiscard(orphaned.map((id) => ({ id, label: labels.get(id) ?? "" })));
        held.current = { questionId, value };
        return;
      }
      apply(questionId, value);
    },
    [answers, apply, definition],
  );

  function confirmDiscard() {
    confirmed.current = true;
    const queued = held.current;
    held.current = null;
    setDiscard(null);
    if (queued !== null) apply(queued.questionId, queued.value);
    if (timer.current !== null) clearTimeout(timer.current);
    void flush();
  }

  function cancelDiscard() {
    const wasHeldLocally = held.current !== null;
    held.current = null;
    setDiscard(null);
    setSaveState("idle");
    // Nothing was held locally, so the discard came back from the server
    // against a batch it had already queued. Drop it rather than re-prompting
    // on every retry, and say so.
    if (!wasHeldLocally) {
      pending.current = {};
      setNotice("That change was not saved. Reload to see the answers on record.");
    }
  }

  async function goNext() {
    if (section === undefined) return;
    if (timer.current !== null) clearTimeout(timer.current);
    await flush();
    const next = resolveNextSection(definition, section.id, answers);
    if (next.kind === "section") setSectionId(next.sectionId);
  }

  function goBack() {
    const previous = path[index - 1];
    if (previous) setSectionId(previous.id);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setNotice(null);
    if (timer.current !== null) clearTimeout(timer.current);
    await flush();

    // A convenience pass so the obvious gaps do not cost a round trip. The
    // server recomputes reachability and validates again; that result wins.
    const local = validateAnswers(reachability.questions, answers);
    if (!local.success) {
      showErrors(local.errors);
      setSubmitting(false);
      return;
    }

    const result = await submitForm(slug);
    if (result.status === "submitted") {
      router.push(`/${slug}/review`);
      router.refresh();
      return;
    }
    if (result.status === "invalid") showErrors(result.errors);
    else setNotice(result.message);
    setSubmitting(false);
  }

  function showErrors(list: ValidationError[]) {
    const byQuestion = firstErrorPerQuestion(list);
    setErrors(byQuestion);
    setNotice("Some answers need attention before this can be submitted.");
    const target = path.find((each) =>
      each.questions.some((question) => byQuestion[question.id] !== undefined),
    );
    if (target) setSectionId(target.id);
  }

  if (section === undefined) {
    return <p className="text-sm text-muted-foreground">This form has no sections yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Section {index + 1} of {path.length}
          </span>
          <span aria-live="polite">{SAVE_LABELS[saveState]}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((index + 1) / path.length) * 100}%` }}
          />
        </div>
      </div>

      {editing ? (
        <p className="rounded-md border bg-muted/40 p-3 text-sm">
          Your application is submitted. Questions the organizers left open are still editable and
          save as you type.{" "}
          <Link href={`/${slug}/review`} className="underline underline-offset-4">
            View your application
          </Link>
        </p>
      ) : null}

      {discard !== null ? (
        <div
          role="alertdialog"
          aria-labelledby="discard-title"
          className="flex flex-col gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-4"
        >
          <p id="discard-title" className="text-sm font-medium">
            Changing this answer deletes work you have already done
          </p>
          <p className="text-sm text-muted-foreground">
            These answers belong to a section you will no longer see, so they will be removed:
          </p>
          <ul className="list-disc pl-5 text-sm">
            {discard.map((question) => (
              <li key={question.id}>{question.label}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" size="sm" onClick={confirmDiscard}>
              Discard and continue
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={cancelDiscard}>
              Keep my answers
            </Button>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.description ? (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          ) : null}
        </div>

        {section.questions.map((question) => {
          const editable = canEditQuestion(editPolicy, question, status);
          return (
            <div key={question.id} className="flex flex-col gap-1">
              <QuestionField
                question={question}
                value={fieldValue(question, answers[question.id])}
                onChange={(value) => change(question.id, value)}
                error={errors[question.id] ?? null}
                disabled={!editable}
              />
              {editable ? null : (
                <p className="text-xs text-muted-foreground">
                  Locked — this answer cannot be changed after submitting.
                </p>
              )}
            </div>
          );
        })}
      </section>

      {notice !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={index === 0}>
          Back
        </Button>
        {atEnd ? (
          editing ? (
            <Button type="button" onClick={() => router.push(`/${slug}/review`)}>
              Done
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit application"}
            </Button>
          )
        ) : (
          <Button type="button" onClick={goNext}>
            Next
          </Button>
        )}
        {saveState === "failed" ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void flush()}>
            Retry save
          </Button>
        ) : null}
      </div>
    </div>
  );
}
