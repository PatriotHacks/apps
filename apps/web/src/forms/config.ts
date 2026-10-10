/* =====================================================================
 * PatriotHacks — volunteer & judge application forms
 * ---------------------------------------------------------------------
 * Both forms are data, not JSX: edit the copy, questions, and
 * acknowledgements here and both pages follow.
 *
 * IMPORTANT: every `name` below must match a column in the matching
 * Supabase table (see schema.sql). The form submits the field
 * names verbatim as the insert payload.
 * ===================================================================== */

import { FOOTER } from '../config'

/** A question on the form. `name` == the database column. */
export type Field =
  | {
      kind: 'text' | 'email'
      name: string
      label: string
      placeholder: string
      /** Mirrors the CHECK constraint in schema.sql. */
      maxLength: number
      autoComplete?: string
    }
  | {
      kind: 'textarea'
      name: string
      label: string
      placeholder: string
      maxLength: number
      help?: string
    }
  | {
      kind: 'yesno'
      name: string
      label: string
    }

/** A required checkbox. `name` == the database column. */
export type Ack = {
  name: string
  text: string
  link?: { label: string; href: string }
}

export type FormDef = {
  /** Supabase table to insert into. */
  table: string
  /** Page path, used for the <title> and the "Interested?" buttons. */
  path: string
  title: string
  description: string
  fields: Field[]
  acks: Ack[]
  /** Shown after a successful insert. */
  successTitle: string
  successBody: string
  /** Shown when the email is already in the table (Postgres 23505). */
  duplicateMessage: string
}

/* ------------------------------------------------------------------ *
 * Questions shared by both forms.
 * ------------------------------------------------------------------ */
const NAME_FIELD: Field = {
  kind: 'text',
  name: 'name',
  label: 'What is your name?',
  placeholder: 'Jane Patriot',
  autoComplete: 'name',
  maxLength: 120,
}

const EMAIL_FIELD: Field = {
  kind: 'email',
  name: 'email',
  label: 'What is your most used email?',
  placeholder: 'you@example.com',
  autoComplete: 'email',
  maxLength: 254,
}

const ALUM_FIELD: Field = {
  kind: 'yesno',
  name: 'is_gmu_alum',
  label: 'Are you a George Mason University alum?',
}

/* ------------------------------------------------------------------ *
 * Acknowledgements — all four are required to submit, and the database
 * enforces the same thing with CHECK constraints.
 * ------------------------------------------------------------------ */
function acks(role: 'volunteering' | 'judging'): Ack[] {
  return [
    {
      name: 'ack_transportation',
      text: 'I understand that if selected, I am responsible for arranging my own transportation to and from the event.',
    },
    {
      name: 'ack_commitment',
      text:
        role === 'volunteering'
          ? 'I understand that if selected, I am expected to be present for the full duration of my assigned shift.'
          : 'I understand that if selected, I am expected to be present for the full duration of my assigned judging block.',
    },
    {
      name: 'ack_code_of_conduct',
      text: 'I agree to abide by the MLH Code of Conduct.',
      link: { label: 'Read it here', href: FOOTER.codeOfConductUrl },
    },
    {
      name: 'ack_contact',
      text: 'I consent to being contacted at this email address about PatriotHacks.',
    },
  ]
}

/* ------------------------------------------------------------------ *
 * The two forms.
 * ------------------------------------------------------------------ */
export const VOLUNTEER_FORM: FormDef = {
  table: 'volunteers',
  path: '/volunteer',
  title: 'Volunteer at PatriotHacks',
  description:
    "Volunteers keep PatriotHacks running — checking hackers in, handing out meals, staffing the help desk, and making sure everyone has what they need. It's the best seat in the house if you want to see how a hackathon actually comes together. Fill this out and we'll reach out as the event gets closer with shifts and details.",
  fields: [
    NAME_FIELD,
    EMAIL_FIELD,
    ALUM_FIELD,
    {
      kind: 'textarea',
      name: 'reason',
      label: 'Why do you want to volunteer?',
      placeholder: 'Tell us a little about what draws you to PatriotHacks.',
      maxLength: 2000,
    },
  ],
  acks: acks('volunteering'),
  successTitle: "You're on the volunteer list.",
  successBody:
    "Thanks for signing up. We'll email you as the event gets closer with shift options and next steps.",
  duplicateMessage:
    "This email has already submitted a volunteer application. If you think that's a mistake, reach out to us.",
}

export const JUDGE_FORM: FormDef = {
  table: 'judges',
  path: '/judge',
  title: 'Judge at PatriotHacks',
  description:
    "Judges spend a few hours at the end of the event meeting teams, hearing demos, and picking the projects that stand out. We're looking for engineers, designers, founders, researchers, and industry folks of every stripe — you do not need to be an expert in every technology on the table. Fill this out and we'll follow up with the judging schedule.",
  fields: [
    NAME_FIELD,
    EMAIL_FIELD,
    ALUM_FIELD,
    {
      kind: 'text',
      name: 'company',
      label: 'What company or organization are you with?',
      placeholder: 'Acme Corp, George Mason University, self-employed…',
      autoComplete: 'organization',
      maxLength: 160,
    },
    {
      kind: 'text',
      name: 'job_title',
      label: 'What is your role or job title?',
      placeholder: 'Senior Software Engineer',
      autoComplete: 'organization-title',
      maxLength: 160,
    },
    {
      kind: 'text',
      name: 'expertise',
      label: 'What is your area of expertise?',
      placeholder: 'Machine learning, embedded systems, product design…',
      maxLength: 300,
    },
    {
      kind: 'textarea',
      name: 'reason',
      label: 'Why do you want to judge?',
      placeholder: 'Tell us a little about what draws you to PatriotHacks.',
      maxLength: 2000,
    },
  ],
  acks: acks('judging'),
  successTitle: "You're on the judge list.",
  successBody:
    "Thanks for signing up. We'll email you as the event gets closer with the judging schedule and next steps.",
  duplicateMessage:
    "This email has already submitted a judge application. If you think that's a mistake, reach out to us.",
}
