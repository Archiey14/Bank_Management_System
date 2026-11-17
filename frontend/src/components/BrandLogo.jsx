import { useId } from 'react'
import { Link } from 'react-router-dom'
import './brand.css'

/** The Northbank "N" mark. Self-contained, so it looks right on light and dark backgrounds. */
export function NorthbankMark({ size = 36, className = '' }) {
  const gradientId = useId()
  return (
    <svg
      className={`nb-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7b7fe0" />
          <stop offset="1" stopColor="#2b3678" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <path
        d="M20 46V18l24 28V18"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Logo lockup: mark + "northbank" wordmark (+ optional subtitle).
 * It inherits its text colour from the parent, so it works on the navy hero
 * and on light or dark page backgrounds alike.
 *
 * variant: 'md' (default) | 'hero' (white text, for navy backgrounds) | 'footer' | 'side'
 */
export default function BrandLogo({
  to = '/',
  size = 36,
  tagline = true,
  subtitle = 'Banking workspace',
  variant = 'md',
  className = '',
  label = 'Northbank home',
}) {
  const content = (
    <>
      <NorthbankMark size={size} />
      <span className="nb-brand__text">
        <span className="nb-brand__name">northbank</span>
        {tagline && <span className="nb-brand__sub">{subtitle}</span>}
      </span>
    </>
  )

  const classes = `nb-brand nb-brand--${variant} ${className}`.trim()

  if (!to) {
    return <span className={classes}>{content}</span>
  }
  return (
    <Link to={to} className={classes} aria-label={label}>
      {content}
    </Link>
  )
}
