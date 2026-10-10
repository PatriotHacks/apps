import { useRef, useState } from 'react'
import { SIGNUP_ENDPOINT, isSignupConfigured } from '../config'

type Status = 'idle' | 'submitting' | 'done'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Interest-list capture. Each email is POSTed to a Google Apps Script
 * Web App that appends it (with a timestamp) to a private Google Sheet —
 * a "hidden database" only the organizers can see. The request is sent
 * no-cors (Apps Script returns an opaque response), so we optimistically
 * show success once it's fired. If no endpoint is configured yet (see
 * SIGNUP_ENDPOINT in src/config.ts) it runs in demo mode and stores
 * nothing.
 *
 * Validation is handled ourselves (the form is noValidate) so an empty or
 * invalid email just turns the box outline red instead of showing the
 * browser's native "Please fill out this field" bubble.
 */
export default function EmailSignup() {
  const [status, setStatus] = useState<Status>('idle')
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'submitting') return

    if (!EMAIL_RE.test(email.trim())) {
      setInvalid(true)
      inputRef.current?.focus()
      return
    }

    setInvalid(false)
    setStatus('submitting')

    if (isSignupConfigured) {
      try {
        await fetch(SIGNUP_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ email }).toString(),
        })
      } catch {
        // no-cors gives an opaque response; the append still happens.
      }
    }

    setStatus('done')
    setEmail('')
  }

  if (status === 'done') {
    return (
      <div
        className="flex w-full max-w-md items-center justify-start gap-3 rounded-none border border-mason/30 bg-mason-soft px-5 py-4"
        role="status"
      >
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-mason text-white"
        >
          ✓
        </span>
        <p className="text-left text-sm text-mason-deep sm:text-base">
          You're on the list. We'll email you when registration opens.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full max-w-md">
      <label htmlFor="ph-email" className="sr-only">
        Email address
      </label>
      <div
        className={`flex flex-col gap-2 rounded-none border bg-paper p-2 shadow-[0_10px_40px_-16px_rgba(15,23,18,0.25)] transition-colors sm:flex-row sm:p-1.5 sm:pl-5 ${
          invalid ? 'border-red-500' : 'border-line'
        }`}
      >
        <input
          ref={inputRef}
          id="ph-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={invalid}
          placeholder="Enter your email here..."
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (invalid) setInvalid(false)
          }}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-ink placeholder:text-slate/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="shrink-0 rounded-none bg-mason px-6 py-3 font-semibold text-white shadow-[0_6px_20px_-6px_rgba(0,102,51,0.6)] transition hover:bg-mason-deep focus-visible:outline-offset-4 disabled:opacity-70"
        >
          {status === 'submitting' ? 'Joining…' : 'Notify me'}
        </button>
      </div>
    </form>
  )
}
