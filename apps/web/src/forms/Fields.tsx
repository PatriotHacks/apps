/* Form field primitives, styled to match the site: sharp corners, hairline
 * borders, GMU green focus. Each one renders its own label and error text. */

const inputBase =
  'w-full rounded-none border bg-paper px-4 py-3 text-ink placeholder:text-slate/50 transition-colors focus:outline-none focus:border-mason'

function borderClass(invalid: boolean) {
  return invalid ? 'border-red-500' : 'border-line'
}

function Shell({
  htmlFor,
  label,
  error,
  children,
}: {
  htmlFor: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-base font-medium text-ink sm:text-lg"
      >
        {label}
      </label>
      <div className="mt-3">{children}</div>
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({
  name,
  label,
  type,
  placeholder,
  autoComplete,
  maxLength,
  value,
  error,
  onChange,
}: {
  name: string
  label: string
  type: 'text' | 'email'
  placeholder: string
  autoComplete?: string
  maxLength: number
  value: string
  error?: string
  onChange: (v: string) => void
}) {
  return (
    <Shell htmlFor={name} label={label} error={error}>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={type === 'email' ? 'email' : undefined}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} ${borderClass(Boolean(error))}`}
      />
    </Shell>
  )
}

export function TextAreaField({
  name,
  label,
  placeholder,
  maxLength,
  value,
  error,
  onChange,
}: {
  name: string
  label: string
  placeholder: string
  maxLength: number
  value: string
  error?: string
  onChange: (v: string) => void
}) {
  return (
    <Shell htmlFor={name} label={label} error={error}>
      <textarea
        id={name}
        name={name}
        rows={5}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} resize-y ${borderClass(Boolean(error))}`}
      />
      <p className="mt-2 text-right text-xs text-slate/70">
        {value.length} / {maxLength}
      </p>
    </Shell>
  )
}

/** Yes / No pair rendered as a radiogroup so arrow keys work. */
export function YesNoField({
  name,
  label,
  value,
  error,
  onChange,
}: {
  name: string
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset>
      <legend className="text-base font-medium text-ink sm:text-lg">
        {label}
      </legend>
      <div className="mt-3 flex gap-3">
        {['Yes', 'No'].map((option) => {
          const selected = value === option
          return (
            <label
              key={option}
              className={`flex-1 cursor-pointer rounded-none border px-5 py-3 text-center font-medium transition-colors sm:flex-none sm:min-w-32 ${
                selected
                  ? 'border-mason bg-mason-soft text-mason-deep'
                  : `${borderClass(Boolean(error))} bg-paper text-slate hover:border-mason/50`
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={selected}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${name}-error` : undefined}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {option}
            </label>
          )
        })}
      </div>
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}

export function AckCheckbox({
  name,
  text,
  link,
  checked,
  invalid,
  onChange,
}: {
  name: string
  text: string
  link?: { label: string; href: string }
  checked: boolean
  invalid: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      htmlFor={name}
      className={`flex cursor-pointer items-start gap-3 border-l-2 py-1 pl-4 transition-colors ${
        invalid ? 'border-red-500' : 'border-line'
      }`}
    >
      <input
        id={name}
        name={name}
        type="checkbox"
        checked={checked}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-[var(--color-mason)]"
      />
      <span className="text-sm leading-relaxed text-slate">
        {text}
        {link && (
          <>
            {' '}
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-mason underline decoration-mason/40 underline-offset-2 transition hover:decoration-mason"
            >
              {link.label}
            </a>
          </>
        )}
      </span>
    </label>
  )
}

/**
 * Honeypot — a decoy field kept out of view and out of the tab order.
 * Real users never see it, so anything typed into it came from a bot that
 * filled every input it could find. Positioned off-screen rather than
 * `display: none`, which the less naive bots check for.
 */
export function Honeypot({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden"
    >
      <label htmlFor="website">Website</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
