-- Removing a question from a live form has to remove the answers to it first:
-- `answers.question_id` carries no cascade, so the question delete would fail on
-- the foreign key. Every existing delete policy on `answers` is scoped to the
-- caller's own submission, so an admin's delete matched no rows and the failure
-- surfaced as a foreign key violation rather than as a missing policy.
--
-- The delete trigger still writes every removed value to `answer_revisions`.
CREATE POLICY "answers_delete_admin" ON "answers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin((select auth.uid())));
