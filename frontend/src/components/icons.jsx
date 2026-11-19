const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const ShieldCheckIcon = ({ size = 16 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

export const EyeIcon = () => (
  <svg {...base} width={18} height={18}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const EyeOffIcon = () => (
  <svg {...base} width={18} height={18}>
    <path d="M17.9 17.9A10.6 10.6 0 0112 19C5.6 19 2 12 2 12a18.4 18.4 0 014.1-5.1M9.9 5.2A9.9 9.9 0 0112 5c6.4 0 10 7 10 7a18.5 18.5 0 01-2.2 3.2M1 1l22 22" />
    <path d="M14.1 14.1a3 3 0 01-4.2-4.2" />
  </svg>
)

export const ArrowRightIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const LockIcon = () => (
  <svg {...base} width={15} height={15}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
)

export const CheckIcon = () => (
  <svg {...base} width={12} height={12} strokeWidth={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const TrendUpIcon = () => (
  <svg {...base} width={9} height={9} strokeWidth={2.5}>
    <path d="M7 17L17 7M8 7h9v9" />
  </svg>
)

export const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
)
