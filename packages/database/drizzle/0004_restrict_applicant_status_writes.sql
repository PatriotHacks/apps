-- RLS decides which ROWS a caller may update, never which COLUMNS. `submissions_update_own`
-- allows an applicant to update their own row, and `authenticated` holds UPDATE on every
-- column, so an applicant could set their own status to 'accepted'. Verified exploitable.
--
-- Applicants legitimately make exactly two kinds of write: submitting a draft, and answering
-- RSVP. Everything else on this table belongs to staff.

create or replace function public.enforce_submission_write_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Staff go through the admin policy; nothing here applies to them.
  if public.is_admin((select auth.uid())) then
    return new;
  end if;

  -- An applicant may submit a draft. Any other status change is an escalation.
  if new.status is distinct from old.status
     and not (old.status = 'draft' and new.status = 'submitted') then
    raise exception 'applicants may not change submission status from % to %', old.status, new.status
      using errcode = '42501';
  end if;

  -- Decision provenance is staff-owned regardless of status.
  if new.decided_at is distinct from old.decided_at
     or new.decided_by is distinct from old.decided_by then
    raise exception 'applicants may not set decision fields'
      using errcode = '42501';
  end if;

  -- Identity of the row is fixed once created.
  if new.user_id is distinct from old.user_id or new.form_id is distinct from old.form_id then
    raise exception 'applicants may not reassign a submission'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_enforce_write_scope on public.submissions;
create trigger submissions_enforce_write_scope
  before update on public.submissions
  for each row execute function public.enforce_submission_write_scope();
