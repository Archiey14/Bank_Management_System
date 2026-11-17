import { useEffect } from 'react'

// Small dialog built on the existing modal styles (cookie.css).
export default function Modal({ title, sub, onClose, busy = false, maxWidth = 460, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  return (
    <div
      className="cookie-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="cookie-modal" style={{ maxWidth }}>
        <div className="cookie-modal__head">
          <div>
            <h3 className="cookie-modal__title">{title}</h3>
            {sub && <p className="cookie-modal__sub">{sub}</p>}
          </div>
          <button
            type="button"
            className="cookie-modal__close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
