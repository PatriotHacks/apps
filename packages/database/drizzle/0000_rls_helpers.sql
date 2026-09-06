-- Role predicates used by nearly every policy in the next migration.
--
-- SECURITY DEFINER is load-bearing, not decoration. A policy that reads
-- `admins` directly is itself filtered by `admins` RLS, whose policies read
-- `admins` again -- Postgres reports "infinite recursion detected in policy".
-- Running as the owner sidesteps RLS on the lookup entirely.
--
-- These are created before the tables they read. PL/pgSQL bodies are only
-- syntax-checked at CREATE FUNCTION time, so the forward reference is legal and
-- the ordering constraint runs the other way: the policies in 0001 cannot be
-- created unless these functions already exist.

CREATE OR REPLACE FUNCTION public.is_organizer(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admins a WHERE a.user_id = uid
  );
END;
$$;
--> statement-breakpoint
-- Admin is a superset of organizer, so `is_organizer` is true for both roles and
-- is the predicate for "any console user".
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admins a
    WHERE a.user_id = uid AND a.role = 'admin'::public.admin_role
  );
END;
$$;
