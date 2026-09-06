-- Triggers. Drizzle's DSL has no representation for these, so they live in a
-- hand-written migration alongside the generated one.

-- One profile row per auth user, created by the database rather than by
-- application code so no sign-in path can forget it.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(
      COALESCE(
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name'
      ),
      ''
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- Append-only answer history.
--
-- UPDATE records the superseded value; DELETE records a branch discard, which
-- is why answer_revisions is not keyed on answers.id -- the row it describes is
-- gone by the time anyone reads the revision.
CREATE OR REPLACE FUNCTION public.record_answer_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.value IS NOT DISTINCT FROM OLD.value THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.answer_revisions (submission_id, question_id, prev_value, reason, edited_by)
    VALUES (OLD.submission_id, OLD.question_id, OLD.value, 'edit'::public.revision_reason, actor);
    RETURN NEW;
  END IF;

  INSERT INTO public.answer_revisions (submission_id, question_id, prev_value, reason, edited_by)
  VALUES (OLD.submission_id, OLD.question_id, OLD.value, 'branch_discarded'::public.revision_reason, actor);
  RETURN OLD;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS answers_record_revision ON public.answers;
--> statement-breakpoint
CREATE TRIGGER answers_record_revision
AFTER UPDATE OR DELETE ON public.answers
FOR EACH ROW EXECUTE FUNCTION public.record_answer_revision();
