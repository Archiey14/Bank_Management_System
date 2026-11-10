import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'

export default function PasswordField({ id, value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="input-wrap">
      <input
        id={id}
        className="input"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="input-icon-btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
