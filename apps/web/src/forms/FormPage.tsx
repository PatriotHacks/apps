import { useRef, useState } from 'react'
import type { FormDef } from './config'
import { isSupabaseConfigured, submitApplication } from './supabase'
import { AckCheckbox, Honeypot, TextAreaField, TextField, YesNoField } from './Fields'
import Footer from '../components/Footer'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Anything that fills out this entire form — several text fields, a radio
 * choice, a written answer, and four checkboxes — in under three seconds is
 * not a person. Only ever checked against an otherwise-valid submission, so a
 * fast human who left a field blank still gets normal validation errors.
 */
const MIN_FILL_MS = 3000

type Status = 'idle' | 'submitting' | 'done'

/** Minimal header — the marketing nav would be noise on a form. */
function FormHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4 sm:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label="PatriotHacks home">
          <img
            src="/logo.png"
            alt=""
            aria-hidden
            className="h-8 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            PatriotHacks
          </span>
        </a>
        <a
          href="/"
          className="text-sm font-medium text-slate transition hover:text-ink"
        >
          ← Back to site
        </a>
      </div>
    </header>
  )
}

export default function FormPage({ def }: { def: FormDef }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(def.fields.map((f) => [f.name, ''])),
  )
  const [acks, setAcks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(def.acks.map((a) => [a.name, false])),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [acksInvalid, setAcksInvalid] = useState(false)
  const [formError, setFormError] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [honeypot, setHoneypot] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const openedAt = useRef(Date.now())

  const setValue = (name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }))
    // Clear the field's error as soon as the user starts fixing it.
    setErrors((prev) => (name in prev ? omit(prev, name) : prev))
  }

  const setAck = (name: string, v: boolean) => {
    setAcks((prev) => ({ ...prev, [name]: v }))
    if (acksInvalid) setAcksInvalid(false)
  }

  const validate = () => {
    const next: Record<string, string> = {}

    for (const field of def.fields) {
      const value = values[field.name].trim()

      if (!value) {
        next[field.name] =
          field.kind === 'yesno' ? 'Please choose an option.' : 'This field is required.'
        continue
      }
      if (field.kind === 'email' && !EMAIL_RE.test(value)) {
        next[field.name] = 'Please enter a valid email address.'
      }
    }

    const missingAcks = def.acks.some((a) => !acks[a.name])
    setErrors(next)
    setAcksInvalid(missingAcks)
    return Object.keys(next).length === 0 && !missingAcks
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'submitting') return

    setFormError('')

    if (!validate()) {
      // Let the state flush, then jump to whatever is wrong.
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus()
      })
      return
    }

    /* Bot traps, checked only once the submission is otherwise valid so they
     * can never swallow a real person's mistake. A caught bot is shown the
     * ordinary success screen and nothing is stored — telling it that it was
     * caught would just teach whoever wrote it what to fix. */
    const trippedHoneypot = honeypot.trim() !== ''
    const filledImpossiblyFast = Date.now() - openedAt.current < MIN_FILL_MS

    if (trippedHoneypot || filledImpossiblyFast) {
      setStatus('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setStatus('submitting')

    const payload: Record<string, string | boolean> = {}
    for (const field of def.fields) {
      const value = values[field.name].trim()
      if (field.kind === 'yesno') {
        payload[field.name] = value === 'Yes'
      } else if (field.kind === 'email') {
        payload[field.name] = value.toLowerCase()
      } else {
        payload[field.name] = value
      }
    }
    for (const ack of def.acks) payload[ack.name] = true

    const result = await submitApplication(def.table, payload)

    if (result.status === 'ok') {
      setStatus('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setStatus('idle')

    if (result.status === 'duplicate') {
      setErrors({ email: def.duplicateMessage })
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('#email')?.focus(),
      )
      return
    }

    setFormError(result.message)
  }

  return (
    <>
      <FormHeader />

      <main className="bg-paper px-6 py-16 sm:px-8 sm:py-24">
        <div className="animate-rise mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {def.title}
          </h1>

          {status === 'done' ? (
            <div
              className="mt-8 border border-mason/30 bg-mason-soft px-6 py-6"
              role="status"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-mason text-white"
                >
                  ✓
                </span>
                <div>
                  <p className="text-lg font-semibold text-mason-deep">
                    {def.successTitle}
                  </p>
                  <p className="mt-2 leading-relaxed text-mason-deep/90">
                    {def.successBody}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-5 leading-relaxed text-slate">{def.description}</p>

              {!isSupabaseConfigured && (
                <p
                  role="alert"
                  className="mt-8 border border-amber-400 bg-amber-50 px-5 py-4 text-sm text-amber-900"
                >
                  This form is not connected to a database yet, so submissions
                  will not be saved. Set <code>VITE_SUPABASE_URL</code> and{' '}
                  <code>VITE_SUPABASE_ANON_KEY</code> to enable it.
                </p>
              )}

              <form
                ref={formRef}
                onSubmit={handleSubmit}
                noValidate
                className="relative mt-10 flex flex-col gap-8"
              >
                <Honeypot value={honeypot} onChange={setHoneypot} />

                {def.fields.map((field) => {
                  const error = errors[field.name]

                  if (field.kind === 'yesno') {
                    return (
                      <YesNoField
                        key={field.name}
                        name={field.name}
                        label={field.label}
                        value={values[field.name]}
                        error={error}
                        onChange={(v) => setValue(field.name, v)}
                      />
                    )
                  }

                  if (field.kind === 'textarea') {
                    return (
                      <TextAreaField
                        key={field.name}
                        name={field.name}
                        label={field.label}
                        placeholder={field.placeholder}
                        maxLength={field.maxLength}
                        value={values[field.name]}
                        error={error}
                        onChange={(v) => setValue(field.name, v)}
                      />
                    )
                  }

                  return (
                    <TextField
                      key={field.name}
                      name={field.name}
                      label={field.label}
                      type={field.kind}
                      placeholder={field.placeholder}
                      autoComplete={field.autoComplete}
                      maxLength={field.maxLength}
                      value={values[field.name]}
                      error={error}
                      onChange={(v) => setValue(field.name, v)}
                    />
                  )
                })}

                <fieldset className="border-t border-line pt-8">
                  <legend className="sr-only">Acknowledgements</legend>
                  <p className="text-base font-medium text-ink sm:text-lg">
                    Before you submit, please confirm:
                  </p>
                  <div className="mt-4 flex flex-col gap-4">
                    {def.acks.map((ack) => (
                      <AckCheckbox
                        key={ack.name}
                        name={ack.name}
                        text={ack.text}
                        link={ack.link}
                        checked={acks[ack.name]}
                        invalid={acksInvalid && !acks[ack.name]}
                        onChange={(v) => setAck(ack.name, v)}
                      />
                    ))}
                  </div>
                  {acksInvalid && (
                    <p role="alert" className="mt-3 text-sm text-red-600">
                      Please check every box to continue.
                    </p>
                  )}
                </fieldset>

                {formError && (
                  <p
                    role="alert"
                    className="border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-700"
                  >
                    {formError}
                  </p>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="w-full rounded-none bg-mason px-8 py-4 font-semibold text-white shadow-[0_6px_20px_-6px_rgba(0,102,51,0.6)] transition hover:bg-mason-deep focus-visible:outline-offset-4 disabled:opacity-70 sm:w-auto"
                  >
                    {status === 'submitting' ? 'Submitting…' : 'Submit application'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  )
}

function omit(obj: Record<string, string>, key: string) {
  const { [key]: _removed, ...rest } = obj
  return rest
}
