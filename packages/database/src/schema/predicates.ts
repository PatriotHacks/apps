import { sql } from "drizzle-orm";

/**
 * Shared RLS predicates.
 *
 * `is_admin` and `is_organizer` are SECURITY DEFINER functions created in the
 * first hand-written migration. Inlining `exists (select 1 from admins ...)`
 * instead would recurse: the subquery is itself subject to `admins` RLS, whose
 * policies would run the same subquery again.
 *
 * `is_organizer` is true for both roles — admin is a superset of organizer — so
 * it is the predicate for "any console user".
 *
 * `(select auth.uid())` rather than a bare `auth.uid()` so Postgres treats it as
 * an InitPlan and evaluates it once per statement instead of once per row.
 */
export const isAdmin = () => sql`public.is_admin((select auth.uid()))`;

export const isOrganizer = () => sql`public.is_organizer((select auth.uid()))`;
