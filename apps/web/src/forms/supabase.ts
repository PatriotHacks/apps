/* =====================================================================
 * Supabase client — application form submissions
 * ---------------------------------------------------------------------
 * Credentials come from the environment (see .env.example). The anon key
 * is public by design: it ships inside the JavaScript bundle, and the
 * tables are locked down with Row Level Security so it can only INSERT.
 * It can never read the applicant list. See schema.sql.
 * ===================================================================== */

import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(URL && ANON_KEY)

const client = isSupabaseConfigured
  ? createClient(URL, ANON_KEY, {
      // Nobody signs in here, so skip the session machinery entirely.
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

/** Postgres unique-constraint violation — the email already applied. */
const UNIQUE_VIOLATION = '23505'

export type SubmitResult =
  | { status: 'ok' }
  | { status: 'duplicate' }
  | { status: 'error'; message: string }

/**
 * Insert one application row.
 *
 * The one-submission-per-email guardrail is enforced by the unique index
 * on lower(email), not by looking the email up first — reading the table
 * would mean granting the browser SELECT on every applicant. Instead we
 * just insert and treat error 23505 as "already applied".
 *
 * No `.select()` is chained, so the insert needs no read permission.
 */
export async function submitApplication(
  table: string,
  payload: Record<string, unknown>,
): Promise<SubmitResult> {
  if (!client) {
    return {
      status: 'error',
      message:
        'This form is not connected to a database yet. Please contact the organizers.',
    }
  }

  const { error } = await client.from(table).insert(payload)

  if (!error) return { status: 'ok' }
  if (error.code === UNIQUE_VIOLATION) return { status: 'duplicate' }

  return {
    status: 'error',
    message: 'Something went wrong submitting your application. Please try again.',
  }
}
