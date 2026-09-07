"use server";

import {
  answers,
  formSections,
  forms,
  questionOptions,
  questions,
  type DatabaseTransaction,
  type Form,
} from "@patriothacks/database";
import {
  BRANCH_ACTIONS,
  OPTION_KINDS,
  canBranch,
  getQuestionTypeDefinition,
  hasGrid,
  hasOptions,
  isQuestionType,
  parseAnswerValue,
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

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; needsAnswerConfirmation?: number };

const OK: ActionResult = { ok: true };

const EDIT_POLICIES = ["locked", "per_question", "full"] as const;

/**
 * The single gate every mutation passes through.
 *
 * Publishing no longer freezes a form, so this no longer refuses one — but the
 * re-read is still the point. The row is loaded inside the same transaction as
 * the write, so an action fired from a page left open sees the form as it is
 * now rather than as it was rendered: a form deleted or published in the
 * meantime is caught here rather than half-applied.
 */
async function withForm<T>(
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

    const value = await run(tx, form);
    await tx.update(forms).set({ updatedAt: new Date() }).where(eq(forms.id, formId));
    return value;
  });

  revalidatePath(`/forms/${formId}/edit`);
  return result;
}

/** Thrown to roll a live form's transaction back; never leaves this module. */
class GraphRejected extends Error {
  constructor(readonly errors: GraphError[]) {
    super("graph rejected");
  }
}

/**
 * The gate for anything that changes the shape of the form: sections,
 * questions, options, branch targets.
 *
 * A draft is checked at publish and nowhere else — half-built forms are
 * unreachable and empty all the time, and refusing those edits would make the
 * builder unusable. A published form gets the same check on every single save,
 * because applicants are walking this graph right now: an unreachable section
 * or a backward jump introduced mid-application is not a problem to discover
 * later. The validation runs inside the write transaction and throws, so a
 * change that would break traversal is rolled back rather than reported after
 * the fact.
 */
async function withStructure(
  formId: string,
  run: (tx: DatabaseTransaction, form: Form) => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    return await withForm(formId, async (tx, form) => {
      const result = await run(tx, form);
      if (!result.ok || form.status === "draft") return result;

      const loaded = await loadFormDefinition(tx, formId);
      if (!loaded) throw new Error("Could not load the form");

      const graph = validateFormGraph(loaded.definition);
      if (!graph.success) throw new GraphRejected(graph.errors);
      return result;
    });
  } catch (error) {
    if (!(error instanceof GraphRejected)) throw error;
    return {
      ok: false,
      message: `Not saved — applicants are filling this form in right now and this would leave it unusable: ${error.errors
        .map((graphError) => graphError.message)
        .join("; ")}`,
    };
  }
}

/**
 * How many answers stand behind these questions. What a delete confirmation
 * names, and what it is checked against a moment later.
 */
async function countAnswers(tx: DatabaseTransaction, questionIds: string[]): Promise<number> {
  if (questionIds.length === 0) return 0;
  return tx.$count(answers, inArray(answers.questionId, questionIds));
}

/**
 * Answers go before the questions they answer. `answers.question_id` carries no
 * cascade, so without this the delete fails on the foreign key — and a cascade
 * would be worse, because it would make losing a live form's responses a side
 * effect of a click rather than something an admin had to confirm. The delete
 * trigger still copies every value into `answer_revisions` on the way out.
 */
async function clearAnswers(tx: DatabaseTransaction, questionIds: string[]): Promise<void> {
  if (questionIds.length === 0) return;
  await tx.delete(answers).where(inArray(answers.questionId, questionIds));
}

/**
 * Which of a question's stored answers would stop being readable under a new
 * type. `answers.value` is jsonb and the type is the only thing that says how
 * to read it, so changing the type without this leaves values no schema
 * describes — the grid the admin sees and the parse the applicant's page runs
 * would disagree, silently. Types that share a value shape (short answer to
 * paragraph, dropdown to multiple choice) strand nothing and return zero.
 */
async function answersInvalidUnder(
  tx: DatabaseTransaction,
  questionId: string,
  type: QuestionType,
): Promise<string[]> {
  const rows = await tx
    .select({ id: answers.id, value: answers.value })
    .from(answers)
    .where(eq(answers.questionId, questionId));
  return rows.filter((row) => !parseAnswerValue(type, row.value).success).map((row) => row.id);
}

/**
 * Refuses a delete whose blast radius grew between the confirmation being shown
 * and the button being pressed. An applicant answering a question while the
 * admin reads the warning is exactly the case this catches: the count in front
 * of them is the count they agreed to, or the delete does not happen.
 */
function answerCountChanged(confirmed: number, actual: number): ActionResult | null {
  if (confirmed === actual) return null;
  return {
    ok: false,
    message:
      actual > confirmed
        ? `Not deleted — ${actual - confirmed} more ${actual - confirmed === 1 ? "answer has" : "answers have"} arrived since that warning was shown. It now holds ${actual}. Check again before deleting.`
        : `Not deleted — this now holds ${actual} ${actual === 1 ? "answer" : "answers"} rather than ${confirmed}. Check again before deleting.`,
  };
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

  // Not structural: the title, slug, window and edit policy carry no edges, so
  // no graph can be broken by writing them.
  return withForm(formId, async (tx) => {
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

export async function addSection(formId: string): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
    const ordered = await sectionIds(tx, formId);
    await tx.insert(formSections).values({
      formId,
      title: `Section ${ordered.length + 1}`,
      position: ordered.length,
    });
    return OK;
  });
}

export async function updateSection(
  formId: string,
  sectionId: string,
  input: { title: string; description: string },
): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
    await tx
      .update(formSections)
      .set({
        title: input.title.trim() || null,
        description: input.description.trim() || null,
      })
      .where(and(eq(formSections.id, sectionId), eq(formSections.formId, formId)));
    return OK;
  });
}

export async function setSectionBranch(
  formId: string,
  sectionId: string,
  action: string,
  targetId: string | null,
): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
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
): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
    const ordered = await sectionIds(tx, formId);
    await renumber(tx, formSections, eq(formSections.formId, formId), moved(ordered, sectionId, delta));
    return OK;
  });
}

/**
 * Deleting a section takes its questions with it — `questions.section_id`
 * cascades — so it takes their answers too, and the count named in the
 * confirmation covers the whole section rather than any one question.
 */
export async function deleteSection(
  formId: string,
  sectionId: string,
  confirmedAnswers: number,
): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
    const owned = await questionIds(tx, sectionId);
    const stale = answerCountChanged(confirmedAnswers, await countAnswers(tx, owned));
    if (stale) return stale;

    await clearAnswers(tx, owned);
    await tx
      .delete(formSections)
      .where(and(eq(formSections.id, sectionId), eq(formSections.formId, formId)));
    await healDanglingJumps(tx, formId);
    await renumber(tx, formSections, eq(formSections.formId, formId), await sectionIds(tx, formId));
    return OK;
  });
}

const SEED_LABELS: Record<OptionKind, string[]> = {
  choice: ["Option 1", "Option 2"],
  grid_row: ["Row 1", "Row 2"],
  grid_column: ["Column 1", "Column 2"],
};

/** The option kinds a type is answered through; empty for text, date and scale. */
function optionKinds(type: QuestionType): OptionKind[] {
  if (hasOptions(type)) return ["choice"];
  if (hasGrid(type)) return ["grid_row", "grid_column"];
  return [];
}

/**
 * A choice question with no choices and a grid with no axes cannot be answered,
 * so a question arrives — and comes out of a type change — with the minimum
 * that makes it usable. Kinds that already hold rows are left alone, which is
 * what lets a dropdown become a multiple choice without losing its options.
 */
async function seedMissingOptions(
  tx: DatabaseTransaction,
  questionId: string,
  type: QuestionType,
): Promise<void> {
  const rows: { questionId: string; kind: OptionKind; label: string; value: string; position: number }[] =
    [];

  for (const kind of optionKinds(type)) {
    if ((await optionIds(tx, questionId, kind)).length > 0) continue;
    rows.push(
      ...SEED_LABELS[kind].map((label, position) => ({
        questionId,
        kind,
        label,
        value: toOptionValue(label),
        position,
      })),
    );
  }

  if (rows.length > 0) await tx.insert(questionOptions).values(rows);
}

/**
 * `afterQuestionId` is what makes the add button belong to a card rather than to
 * the bottom of the page: a question added from the card you are looking at
 * lands under it, not somewhere off screen. The row is inserted at the end and
 * the list renumbered, because positions are unique per section and cannot be
 * shifted up one at a time without colliding.
 */
export async function addQuestion(
  formId: string,
  sectionId: string,
  type: string,
  afterQuestionId: string | null = null,
): Promise<ActionResult> {
  if (!isQuestionType(type)) return { ok: false, message: "Unknown question type." };

  return withStructure(formId, async (tx) => {
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

    await seedMissingOptions(tx, created.id, type);

    const at = afterQuestionId === null ? -1 : ordered.indexOf(afterQuestionId);
    if (at !== -1) {
      const reordered = [...ordered];
      reordered.splice(at + 1, 0, created.id);
      await renumber(tx, questions, eq(questions.sectionId, sectionId), reordered);
    }

    return OK;
  });
}

/**
 * Switching a question's type keeps everything the new type can still hold.
 *
 * The label, help text and answering rules never depend on the type, so they
 * survive untouched. The config survives when the new type's schema accepts it
 * — short answer to paragraph keeps its length limits — and falls back to that
 * type's defaults when it does not, rather than refusing the change and leaving
 * the builder with a card it cannot fix.
 *
 * Options are the part that cannot always carry: a choice list means nothing on
 * a grid and a grid axis means nothing on a text question. Those rows go, the
 * kinds the new type needs are seeded, and a kind both types share is kept
 * exactly as it was.
 */
export async function changeQuestionType(
  formId: string,
  questionId: string,
  type: string,
  confirmedAnswers = 0,
): Promise<ActionResult> {
  if (!isQuestionType(type)) return { ok: false, message: "Unknown question type." };

  return withStructure(formId, async (tx) => {
    const question = await questionOf(tx, formId, questionId);
    if (question.type === type) return OK;

    // Answers that the new type cannot read have to go, for the same reason a
    // deleted question's answers do: nothing else can interpret them again.
    // Confirmed against a fresh count so a race is refused, not absorbed.
    const stranded = await answersInvalidUnder(tx, questionId, type);
    if (stranded.length > 0 && confirmedAnswers !== stranded.length) {
      const n = stranded.length;
      return {
        ok: false,
        needsAnswerConfirmation: n,
        message: `${n} ${n === 1 ? "answer" : "answers"} to this question cannot be read as ${type.replace(/_/g, " ")} and will be deleted. Confirm to continue.`,
      };
    }
    if (stranded.length > 0) {
      await tx.delete(answers).where(inArray(answers.id, stranded));
    }

    const carried = buildConfig(type, question.config ?? {});
    const built = carried.ok ? carried : buildConfig(type, {});
    if (!built.ok) return built;

    await tx
      .update(questions)
      .set({ type, config: built.config, updatedAt: new Date() })
      .where(eq(questions.id, question.id));

    const keep = optionKinds(type);
    const drop = OPTION_KINDS.filter((kind) => !keep.includes(kind));
    if (drop.length > 0) {
      await tx
        .delete(questionOptions)
        .where(
          and(eq(questionOptions.questionId, question.id), inArray(questionOptions.kind, drop)),
        );
    }

    await seedMissingOptions(tx, question.id, type);

    // Traversal ignores an option branch on a type that cannot branch, so a
    // kept jump would be invisible until the type changed back and it
    // reappeared pointing at a section that has since moved.
    if (!canBranch(type)) {
      await tx
        .update(questionOptions)
        .set({ nextAction: "next", nextSectionId: null })
        .where(eq(questionOptions.questionId, question.id));
    }

    return OK;
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

  return withStructure(formId, async (tx) => {
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
  return withStructure(formId, async (tx) => {
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
): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
    const question = await questionOf(tx, formId, questionId);
    const ordered = await questionIds(tx, question.sectionId);
    await renumber(
      tx,
      questions,
      eq(questions.sectionId, question.sectionId),
      moved(ordered, questionId, delta),
    );
    return OK;
  });
}

/**
 * The most destructive thing the console can do to a live form: every answer to
 * this question is deleted with it, and no re-adding brings them back. The count
 * the admin confirmed is re-checked here rather than trusted.
 */
export async function deleteQuestion(
  formId: string,
  questionId: string,
  confirmedAnswers: number,
): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
    const question = await questionOf(tx, formId, questionId);
    const stale = answerCountChanged(confirmedAnswers, await countAnswers(tx, [questionId]));
    if (stale) return stale;

    await clearAnswers(tx, [questionId]);
    await tx.delete(questions).where(eq(questions.id, questionId));
    await renumber(
      tx,
      questions,
      eq(questions.sectionId, question.sectionId),
      await questionIds(tx, question.sectionId),
    );
    return OK;
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
): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
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
    return OK;
  });
}

export async function updateOption(
  formId: string,
  optionId: string,
  label: string,
): Promise<ActionResult> {
  const trimmed = label.trim();
  if (trimmed.length === 0) return { ok: false, message: "An option needs a label." };

  return withStructure(formId, async (tx) => {
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
  return withStructure(formId, async (tx) => {
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
): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
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
    return OK;
  });
}

export async function deleteOption(formId: string, optionId: string): Promise<ActionResult> {
  return withStructure(formId, async (tx) => {
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
    return OK;
  });
}

export interface PublishFailure {
  message: string;
  errors: GraphError[];
}

/**
 * Opens the form to applicants. The structure stays editable afterwards, but
 * this is the moment the graph stops being a draft nobody has walked, so it is
 * validated in full before anyone can start: from here on every structural save
 * is held to the same standard by `withStructure`.
 */
export async function publishForm(
  formId: string,
  confirmation: string,
): Promise<PublishFailure> {
  const failure = await withForm(formId, async (tx, form) => {
    if (form.status !== "draft") {
      return { message: "This form has already been published.", errors: [] };
    }
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
