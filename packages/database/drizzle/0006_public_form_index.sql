-- The form index is readable signed out; filling a form is not.
--
-- `anon` holds Supabase's default table grants but, until now, matched no
-- policy on any table — every statement it issued returned nothing. This is
-- the only opening, and it is deliberately the narrowest one that lets someone
-- see what is open before deciding to make an account:
--
--   * `forms` only. No sections, no questions, no options, and nothing that
--     touches `submissions`, `answers`, `profiles` or the email tables.
--   * Published and not deleted only. Drafts and closed forms stay invisible.
--
-- Reading a form's questions still requires a session, because `questions` and
-- `form_sections` grant `anon` nothing — so the index can list a form that a
-- signed-out visitor cannot open.

CREATE POLICY "forms_select_anon" ON "forms"
  AS PERMISSIVE FOR SELECT TO "anon"
  USING (status = 'published' AND deleted_at IS NULL);
