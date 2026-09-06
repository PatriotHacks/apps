"use server";

import {
  formSections,
  forms,
  questionOptions,
  questions,
  type DatabaseTransaction,
  type Form,
} from "@patriothacks/database";
import {
  BRANCH_ACTIONS,
  canBranch,
  getQuestionTypeDefinition,
  hasGrid,
  hasOptions,
  isQuestionType,
  parseQuestionConfig,
  validateFormGraph,
  type BranchAction,
  type GraphError,
  type OptionKind,
  type QuestionType,
} from "@patriothacks/form-engine";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { queryAsStaff } from "@/lib/db";
import { isUuid, loadFormDefinition } from "@/lib/form-definition";
import { moved, renumber } from "@/lib/positions";
import { isSlug, toOptionValue } from "@/lib/slug";

export type ActionResult = { ok: true } | { ok: false; message: string };

const OK: ActionResult = { ok: true };

const EDIT_POLICIES = ["locked", "per_question", "full"] as const;

/**
 * The single gate every mutation passes through. A published form is immutable,
 * so the status check lives here rather than in each action — and it runs
 * inside the same transaction as the write, so a form published concurrently
 * cannot be edited through a stale page.
 */
async function withDraft<T>(
  formId: string,
  run: (tx: DatabaseTransaction, form: Form) => Promise<T>,
): Promise<T> {
  await requireAdmin();
  if (!isUuid(formId)) throw new Error("Unknown form");

  const result = await queryAsStaff(async (tx) => {
    const [form] = await tx
      .select()
      .from(forms)
      .where(and(eq(forms.id, formId), isNull(forms.deletedAt)))
      .limit(1);
    if (!form) throw new Error("Unknown form");
    if (form.status !== "draft") {
      throw new Error("This form is published and can no longer be edited");
    }

    const value = await run(tx, form);
    await tx.update(forms).set({ updatedAt: new Date() }).where(eq(forms.id, formId));
    return value;
  });

  revalidatePath(`/forms/${formId}/edit`);
  return result;
}

/** Section ids in position order — the list every renumber is derived from. */
async function sectionIds(tx: DatabaseTransaction, formId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: formSections.id })
    .from(formSections)
    .where(eq(formSections.formId, formId))
    .orderBy(asc(formSections.position));
  return rows.map((row) => row.id);
}

async function questionIds(tx: DatabaseTransaction, sectionId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.sectionId, sectionId))
    .orderBy(asc(questions.position));
  return rows.map((row) => row.id);
}

async function optionIds(
  tx: DatabaseTransaction,
  questionId: string,
  kind: OptionKind,
): Promise<string[]> {
  const rows = await tx
    .select({ id: questionOptions.id })
    .from(questionOptions)
    .where(and(eq(questionOptions.questionId, questionId), eq(questionOptions.kind, kind)))
    .orderBy(asc(questionOptions.position));
  return rows.map((row) => row.id);
}

/** The question, confirmed to belong to this form. */
async function questionOf(tx: DatabaseTransaction, formId: string, questionId: string) {
  const [row] = await tx
    .select()
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.formId, formId)))
    .limit(1);
  if (!row) throw new Error("Unknown question");
  return row;
}

/** The option, confirmed to belong to this form, with its question alongside. */
async function optionOf(tx: DatabaseTransaction, formId: string, optionId: string) {
  const [row] = await tx
    .select({ option: questionOptions, question: questions })
    .from(questionOptions)
    .innerJoin(questions, eq(questions.id, questionOptions.questionId))
    .where(and(eq(questionOptions.id, optionId), eq(questions.formId, formId)))
    .limit(1);
  if (!row) throw new Error("Unknown option");
  return row;
}

/**
 * Deleting a section nulls every `next_section_id` that pointed at it, which
 * would leave a `next_action = 'section'` with nothing to jump to. Rather than
 * leave that to be discovered at publish, the jump falls back to continuing.
 */
async function healDanglingJumps(tx: DatabaseTransaction, formId: string): Promise<void> {
  await tx
    .update(formSections)
    .set({ nextAction: "next" })
    .where(
      and(
        eq(formSections.formId, formId),
        eq(formSections.nextAction, "section"),
        isNull(formSections.nextSectionId),
      ),
    );

  const ids = (
    await tx.select({ id: questions.id }).from(questions).where(eq(questions.formId, formId))
  ).map((row) => row.id);
  if (ids.length === 0) return;

  await tx
    .update(questionOptions)
    .set({ nextAction: "next" })
    .where(
      and(
        inArray(questionOptions.questionId, ids),
        eq(questionOptions.nextAction, "section"),
        isNull(questionOptions.nextSectionId),
      ),
    );
}

/**
 * Resolves a requested jump against the section graph. Forward-only is the rule
 * that makes cycles structurally impossible, so it is enforced on the way in as
 * well as at publish.
 */
async function resolveJump(
  tx: DatabaseTransaction,
  formId: string,
  fromSectionId: string,
  action: string,
  targetId: string | null,
): Promise<{ ok: true; action: BranchAction; targetId: string | null } | { ok: false; message: string }> {
  if (!(BRANCH_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, message: "Unknown branch action" };
  }
  const nextAction = action as BranchAction;
  if (nextAction !== "section") return { ok: true, action: nextAction, targetId: null };

  const ordered = await sectionIds(tx, formId);
  const from = ordered.indexOf(fromSectionId);
  const to = targetId === null ? -1 : ordered.indexOf(targetId);

  if (to === -1) return { ok: false, message: "That section is not part of this form" };
  if (to <= from) {
    return { ok: false, message: "A jump target must come after the section it jumps from" };
  }
  return { ok: true, action: nextAction, targetId };
}

/**
 * The only place a `questions.config` blob is produced.
 *
 * `config` is jsonb on one side and Zod-parsed on the other, with nothing
 * connecting the two at compile time — a hand-built blob typechecks and then
 * fails at submit, in production, on a form that may already be immutable.
 * Routing every write through the type's own schema makes the shape the builder
 * stores the shape the validator accepts, by construction, and applies the
 * type's defaults on the way past.
 */
function buildConfig(
  type: QuestionType,
  raw: unknown,
): { ok: true; config: unknown } | { ok: false; message: string } {
  const parsed = parseQuestionConfig(type, raw);
  if (parsed.success) return { ok: true, config: parsed.data };

  return {
    ok: false,
    message: parsed.issues
      .map((issue) => [issue.path.join("."), issue.message].filter(Boolean).join(": "))
      .join("; "),
  };
}

/** `datetime-local` has no zone; the console reads and writes UTC throughout. */
function toInstant(value: string): Date | null | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export interface MetaInput {
  title: string;
  slug: string;
  description: string;
  editPolicy: string;
  opensAt: string;
  closesAt: string;
}

export async function updateMeta(formId: string, input: MetaInput): Promise<ActionResult> {
  const title = input.title.trim();
  const slug = input.slug.trim().toLowerCase();

  if (title.length === 0) return { ok: false, message: "A title is required." };
  if (!isSlug(slug)) {
    return {
      ok: false,
      message: "The slug must be lowercase letters and numbers separated by hyphens.",
    };
  }
  if (!(EDIT_POLICIES as readonly string[]).includes(input.editPolicy)) {
    return { ok: false, message: "Unknown edit policy." };
  }

  const opensAt = toInstant(input.opensAt);
  const closesAt = toInstant(input.closesAt);
  if (opensAt === undefined || closesAt === undefined) {
    return { ok: false, message: "The opening and closing times must be real dates." };
  }
  if (opensAt && closesAt && opensAt >= closesAt) {
    return { ok: false, message: "The form must open before it closes." };
  }

  return withDraft(formId, async (tx) => {
    const [taken] = await tx
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.slug, slug), ne(forms.id, formId)))
      .limit(1);
    if (taken) return { ok: false, message: `The slug "${slug}" is already taken.` };

    await tx
      .update(forms)
      .set({
        title,
        slug,
        description: input.description.trim() || null,
        editPolicy: input.editPolicy as Form["editPolicy"],
        opensAt,
        closesAt,
      })
      .where(eq(forms.id, formId));
    return OK;
  });
}

export async function addSection(formId: string): Promise<void> {
  await withDraft(formId, async (tx) => {
    const ordered = await sectionIds(tx, formId);
    await tx.insert(formSections).values({
      formId,
      title: `Section ${ordered.length + 1}`,
      position: ordered.length,
    });
  });
}

export async function updateSection(
  formId: string,
  sectionId: string,
  input: { title: string; description: string },
): Promise<void> {
  await withDraft(formId, async (tx) => {
    await tx
      .update(formSections)
      .set({
        title: input.title.trim() || null,
        description: input.description.trim() || null,
      })
      .where(and(eq(formSections.id, sectionId), eq(formSections.formId, formId)));
  });
}

export async function setSectionBranch(
  formId: string,
  sectionId: string,
  action: string,
  targetId: string | null,
): Promise<ActionResult> {
  return withDraft(formId, async (tx) => {
    const jump = await resolveJump(tx, formId, sectionId, action, targetId);
    if (!jump.ok) return jump;

    await tx
      .update(formSections)
      .set({ nextAction: jump.action, nextSectionId: jump.targetId })
      .where(and(eq(formSections.id, sectionId), eq(formSections.formId, formId)));
    return OK;
  });
}

export async function moveSection(
  formId: string,
  sectionId: string,
  delta: number,
): Promise<void> {
  await withDraft(formId, async (tx) => {
    const ordered = await sectionIds(tx, formId);
    await renumber(tx, formSections, eq(formSections.formId, formId), moved(ordered, sectionId, delta));
  });
}

export async function deleteSection(formId: string, sectionId: string): Promise<void> {
  await withDraft(formId, async (tx) => {
    await tx
      .delete(formSections)
      .where(and(eq(formSections.id, sectionId), eq(formSections.formId, formId)));
    await healDanglingJumps(tx, formId);
    await renumber(tx, formSections, eq(formSections.formId, formId), await sectionIds(tx, formId));
  });
}

/**
 * A choice question with no choices and a grid with no axes cannot be answered,
 * so a new one arrives with the minimum that makes it usable.
 */
async function seedOptions(
  tx: DatabaseTransaction,
  questionId: string,
  type: QuestionType,
): Promise<void> {
  const rows = [];
  if (hasOptions(type)) {
    rows.push(
      { kind: "choice" as const, label: "Option 1" },
      { kind: "choice" as const, label: "Option 2" },
    );
  }
  if (hasGrid(type)) {
    rows.push(
      { kind: "grid_row" as const, label: "Row 1" },
      { kind: "grid_row" as const, label: "Row 2" },
      { kind: "grid_column" as const, label: "Column 1" },
      { kind: "grid_column" as const, label: "Column 2" },
    );
  }
  if (rows.length === 0) return;

  const counters = new Map<OptionKind, number>();
  await tx.insert(questionOptions).values(
    rows.map((row) => {
      const position = counters.get(row.kind) ?? 0;
      counters.set(row.kind, position + 1);
      return {
        questionId,
        kind: row.kind,
        label: row.label,
        value: toOptionValue(row.label),
        position,
      };
    }),
  );
}

export async function addQuestion(
  formId: string,
  sectionId: string,
  type: string,
): Promise<void> {
  if (!isQuestionType(type)) throw new Error("Unknown question type");

  await withDraft(formId, async (tx) => {
    const [section] = await tx
      .select({ id: formSections.id })
      .from(formSections)
      .where(and(eq(formSections.id, sectionId), eq(formSections.formId, formId)))
      .limit(1);
    if (!section) throw new Error("Unknown section");

    // Defaults come from the type's own schema, so a `file_upload` starts with
    // the allowed types and size cap the validator expects rather than `{}`.
    const built = buildConfig(type, {});
    if (!built.ok) throw new Error(built.message);

    const ordered = await questionIds(tx, sectionId);
    const [created] = await tx
      .insert(questions)
      .values({
        sectionId,
        formId,
        type,
        label: getQuestionTypeDefinition(type).label,
        position: ordered.length,
        config: built.config,
      })
      .returning({ id: questions.id });
    if (!created) throw new Error("Could not add the question");

    await seedOptions(tx, created.id, type);
  });
}

export async function updateQuestion(
  formId: string,
  questionId: string,
  input: {
    label: string;
    helpText: string;
    required: boolean;
    editableAfterSubmit: boolean;
  },
): Promise<ActionResult> {
  const label = input.label.trim();
  if (label.length === 0) return { ok: false, message: "A question needs a label." };

  return withDraft(formId, async (tx) => {
    await tx
      .update(questions)
      .set({
        label,
        helpText: input.helpText.trim() || null,
        required: input.required,
        editableAfterSubmit: input.editableAfterSubmit,
        updatedAt: new Date(),
      })
      .where(and(eq(questions.id, questionId), eq(questions.formId, formId)));
    return OK;
  });
}

export async function updateQuestionConfig(
  formId: string,
  questionId: string,
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  return withDraft(formId, async (tx) => {
    const question = await questionOf(tx, formId, questionId);
    const built = buildConfig(question.type, raw);
    if (!built.ok) return built;

    await tx
      .update(questions)
      .set({ config: built.config, updatedAt: new Date() })
      .where(eq(questions.id, question.id));
    return OK;
  });
}

export async function moveQuestion(
  formId: string,
  questionId: string,
  delta: number,
): Promise<void> {
  await withDraft(formId, async (tx) => {
    const question = await questionOf(tx, formId, questionId);
    const ordered = await questionIds(tx, question.sectionId);
    await renumber(
      tx,
      questions,
      eq(questions.sectionId, question.sectionId),
      moved(ordered, questionId, delta),
    );
  });
}

export async function deleteQuestion(formId: string, questionId: string): Promise<void> {
  await withDraft(formId, async (tx) => {
    const question = await questionOf(tx, formId, questionId);
    await tx.delete(questions).where(eq(questions.id, questionId));
    await renumber(
      tx,
      questions,
      eq(questions.sectionId, question.sectionId),
      await questionIds(tx, question.sectionId),
    );
  });
}

/** Unique among the question's siblings of the same kind; answers key on it. */
function uniqueValue(label: string, taken: Set<string>): string {
  const base = toOptionValue(label) || "option";
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

async function siblingValues(
  tx: DatabaseTransaction,
  questionId: string,
  kind: OptionKind,
  exceptId: string | null,
): Promise<Set<string>> {
  const rows = await tx
    .select({ id: questionOptions.id, value: questionOptions.value })
    .from(questionOptions)
    .where(and(eq(questionOptions.questionId, questionId), eq(questionOptions.kind, kind)));
  return new Set(rows.filter((row) => row.id !== exceptId).map((row) => row.value));
}

const OPTION_LABELS: Record<OptionKind, string> = {
  choice: "Option",
  grid_row: "Row",
  grid_column: "Column",
};

export async function addOption(
  formId: string,
  questionId: string,
  kind: OptionKind,
): Promise<void> {
  await withDraft(formId, async (tx) => {
    await questionOf(tx, formId, questionId);
    const ordered = await optionIds(tx, questionId, kind);
    const label = `${OPTION_LABELS[kind]} ${ordered.length + 1}`;
    await tx.insert(questionOptions).values({
      questionId,
      kind,
      label,
      value: uniqueValue(label, await siblingValues(tx, questionId, kind, null)),
      position: ordered.length,
    });
  });
}

export async function updateOption(
  formId: string,
  optionId: string,
  label: string,
): Promise<ActionResult> {
  const trimmed = label.trim();
  if (trimmed.length === 0) return { ok: false, message: "An option needs a label." };

  return withDraft(formId, async (tx) => {
    const { option } = await optionOf(tx, formId, optionId);
    const taken = await siblingValues(tx, option.questionId, option.kind, option.id);
    await tx
      .update(questionOptions)
      .set({ label: trimmed, value: uniqueValue(trimmed, taken) })
      .where(eq(questionOptions.id, optionId));
    return OK;
  });
}

export async function setOptionBranch(
  formId: string,
  optionId: string,
  action: string,
  targetId: string | null,
): Promise<ActionResult> {
  return withDraft(formId, async (tx) => {
    const { option, question } = await optionOf(tx, formId, optionId);
    if (option.kind !== "choice" || !canBranch(question.type)) {
      return { ok: false, message: "This question type cannot branch." };
    }

    const jump = await resolveJump(tx, formId, question.sectionId, action, targetId);
    if (!jump.ok) return jump;

    await tx
      .update(questionOptions)
      .set({ nextAction: jump.action, nextSectionId: jump.targetId })
      .where(eq(questionOptions.id, optionId));
    return OK;
  });
}

export async function moveOption(
  formId: string,
  optionId: string,
  delta: number,
): Promise<void> {
  await withDraft(formId, async (tx) => {
    const { option } = await optionOf(tx, formId, optionId);
    const ordered = await optionIds(tx, option.questionId, option.kind);
    await renumber(
      tx,
      questionOptions,
      and(
        eq(questionOptions.questionId, option.questionId),
        eq(questionOptions.kind, option.kind),
      )!,
      moved(ordered, optionId, delta),
    );
  });
}

export async function deleteOption(formId: string, optionId: string): Promise<void> {
  await withDraft(formId, async (tx) => {
    const { option } = await optionOf(tx, formId, optionId);
    await tx.delete(questionOptions).where(eq(questionOptions.id, optionId));
    await renumber(
      tx,
      questionOptions,
      and(
        eq(questionOptions.questionId, option.questionId),
        eq(questionOptions.kind, option.kind),
      )!,
      await optionIds(tx, option.questionId, option.kind),
    );
  });
}

export interface PublishFailure {
  message: string;
  errors: GraphError[];
}

/**
 * Irreversible. A published form's structure can never be changed again, so a
 * graph that cannot be traversed can never be repaired either — this validation
 * is the last chance to catch one.
 */
export async function publishForm(
  formId: string,
  confirmation: string,
): Promise<PublishFailure> {
  const failure = await withDraft(formId, async (tx, form) => {
    if (confirmation.trim() !== form.slug) {
      return { message: `Type "${form.slug}" to confirm.`, errors: [] };
    }

    const loaded = await loadFormDefinition(tx, formId);
    if (!loaded) return { message: "Could not load the form.", errors: [] };

    const graph = validateFormGraph(loaded.definition);
    if (!graph.success) {
      return {
        message: "This form cannot be published until the branching is fixed.",
        errors: graph.errors,
      };
    }

    await tx
      .update(forms)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(forms.id, formId));
    return null;
  });

  if (failure) return failure;

  revalidatePath("/forms");
  redirect(`/forms/${formId}`);
}
