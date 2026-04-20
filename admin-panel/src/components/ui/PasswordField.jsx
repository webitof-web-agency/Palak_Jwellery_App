import { useState } from 'react'

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
        <path
          d="M3.5 12s3.5-6.5 8.5-6.5 8.5 6.5 8.5 6.5-3.5 6.5-8.5 6.5S3.5 12 3.5 12Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="m4 4 16 16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6a2.8 2.8 0 0 0 0 2.8 2.8 2.8 0 0 0 3.96 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M6.6 6.8C4.6 8.2 3.5 10 3.5 10s3.5 6.5 8.5 6.5c1.3 0 2.5-.2 3.6-.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M16.8 16.3c2-1.4 3.2-3.3 3.7-4.3 0 0-3.5-6.5-8.5-6.5-.9 0-1.8.1-2.6.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder = 'Enter password',
  autoComplete = 'current-password',
  required = false,
  className = '',
  ariaLabel,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <label className={`field ${className}`.trim()}>
      <span className="field-label">{label}</span>
      <div className="relative">
        <input
          required={required}
          type={visible ? 'text' : 'password'}
          className="input pr-12"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-label={ariaLabel || label}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-muted hover:text-primary hover:bg-white/5 transition-colors"
          aria-pressed={visible}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          title={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
    </label>
  )
}
