import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import { ArrowRightIcon, CheckIcon } from '../components/appIcons'
import { useAuth } from '../context/authStore'
import { createAccountApplication } from '../services/api'
import { formatMinor, toMinorUnits } from '../utils/money'
import { ACCOUNT_TYPE_LABELS, INCOME_BANDS, OCCUPATIONS, incomeBandLabel } from '../utils/format'

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS).filter((type) => type !== 'fixed_deposit')

const STEPS = ['Account', 'Personal', 'Address & work', 'Review']

const emptyForm = {
  accountType: 'savings',
  initialDeposit: '',
  nomineeName: '',
  nomineeRelation: '',
  dob: '',
  phone: '',
  pan: '',
  line1: '',
  city: '',
  state: '',
  pincode: '',
  occupation: 'Salaried',
  annualIncome: '',
}

const todayMinus = (years) => {
  const date = new Date()
  date.setFullYear(date.getFullYear() - years)
  return date.toISOString().slice(0, 10)
}

const validateStep = (step, form) => {
  if (step === 0) {
    if (!ACCOUNT_TYPES.includes(form.accountType)) return 'Choose an account type.'
    if (form.initialDeposit && toMinorUnits(form.initialDeposit) === null) {
      return 'Enter the opening amount in rupees, e.g. 5,000.50.'
    }
    if (form.nomineeName && !form.nomineeRelation.trim()) return 'Enter the nominee relation.'
  }
  if (step === 1) {
    if (!form.dob) return 'Enter your date of birth.'
    const age = (Date.now() - new Date(form.dob).getTime()) / (365.25 * 24 * 3600 * 1000)
    if (Number.isNaN(age) || age < 18) return 'You must be at least 18 years old.'
    if (age > 110) return 'Enter a valid date of birth.'
    if (!/^[6-9]\d{9}$/.test(form.phone)) return 'Enter a valid 10-digit mobile number.'
    if (!/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(form.pan)) return 'Enter a valid PAN, e.g. ABCDE1234F.'
  }
  if (step === 2) {
    if (!form.line1.trim()) return 'Enter your address.'
    if (!form.city.trim()) return 'Enter your city.'
    if (!form.state.trim()) return 'Enter your state.'
    if (!/^\d{6}$/.test(form.pincode)) return 'Enter a valid 6-digit PIN code.'
    if (!form.annualIncome) return 'Select your annual income band.'
  }
  return ''
}

export default function Apply() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  const update = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }))

  const goNext = () => {
    const message = validateStep(step, form)
    setError(message)
    if (!message) setStep((current) => current + 1)
  }

  const goBack = () => {
    setError('')
    setStep((current) => Math.max(0, current - 1))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!agree) {
      setError('Please confirm the declaration to submit.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        accountType: form.accountType,
        dob: form.dob,
        phone: form.phone,
        pan: form.pan.toUpperCase(),
        address: {
          line1: form.line1.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode,
        },
        occupation: form.occupation,
        annualIncome: form.annualIncome,
        nomineeName: form.nomineeName.trim() || undefined,
        nomineeRelation: form.nomineeRelation.trim() || undefined,
        initialDepositMinor: form.initialDeposit ? toMinorUnits(form.initialDeposit) : 0,
      }
      const { application } = await createAccountApplication(payload)
      setSubmitted(application)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit the application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <AppShell>
        <PageHeader eyebrow="Application submitted" title="We have received your request" />
        <div className="db-alert db-alert--success">
          Application <strong>{submitted.applicationNumber}</strong> for a{' '}
          {ACCOUNT_TYPE_LABELS[submitted.accountType].toLowerCase()} account is now{' '}
          <strong>pending review</strong>. The bank usually reviews applications within one working
          day, and the new account appears in your list once approved.
        </div>
        <div className="db-form__actions" style={{ marginTop: 20 }}>
          <Link to="/accounts" className="db-btn db-btn--primary">
            Back to my accounts
          </Link>
          <Link to="/dashboard" className="db-btn db-btn--outline">
            Go to overview
          </Link>
        </div>
      </AppShell>
    )
  }

  const reviewRows = [
    ['Account type', ACCOUNT_TYPE_LABELS[form.accountType]],
    ['Opening deposit', form.initialDeposit ? formatMinor(toMinorUnits(form.initialDeposit)) : 'None'],
    ['Nominee', form.nomineeName ? `${form.nomineeName} (${form.nomineeRelation})` : 'None'],
    ['Date of birth', form.dob],
    ['Mobile', `+91 ${form.phone}`],
    ['PAN', form.pan.toUpperCase()],
    ['Address', `${form.line1}, ${form.city}, ${form.state} – ${form.pincode}`],
    ['Occupation', form.occupation],
    ['Annual income', form.annualIncome ? incomeBandLabel(form.annualIncome) : '—'],
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account application"
        title="Apply for an account"
        sub="A short form, the way the bank would ask for it. Your details are reviewed by our team before the account is opened."
      />

      <div className="apply-steps" aria-label="Application steps">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`apply-step${index === step ? ' is-active' : ''}${index < step ? ' is-done' : ''}`}
            onClick={() => index < step && setStep(index)}
          >
            <span className="apply-step__dot">{index < step ? <CheckIcon /> : index + 1}</span>
            <span className="apply-step__label">{label}</span>
          </button>
        ))}
      </div>

      <div className="db-card">
        <form className="db-form" onSubmit={handleSubmit} noValidate>
          {step === 0 && (
            <>
              <h2 className="db-card__title">Choose your account</h2>
              <p className="db-card__sub">You can hold up to five accounts, including this one.</p>
              <div className="field">
                <label htmlFor="accountType">Account type</label>
                <select
                  id="accountType"
                  className="input db-select"
                  value={form.accountType}
                  onChange={update('accountType')}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="db-form__row">
                <div className="field">
                  <label htmlFor="initialDeposit">Opening deposit (optional)</label>
                  <input
                    id="initialDeposit"
                    className="input"
                    inputMode="decimal"
                    placeholder="e.g. 5,000"
                    value={form.initialDeposit}
                    onChange={update('initialDeposit')}
                  />
                  <div className="field-hint">Credited to the account once it is approved.</div>
                </div>
                <div className="field">
                  <label htmlFor="nomineeName">Nominee (optional)</label>
                  <input
                    id="nomineeName"
                    className="input"
                    placeholder="Full name of the nominee"
                    value={form.nomineeName}
                    onChange={update('nomineeName')}
                  />
                </div>
              </div>
              {form.nomineeName && (
                <div className="field">
                  <label htmlFor="nomineeRelation">Nominee relation</label>
                  <input
                    id="nomineeRelation"
                    className="input"
                    placeholder="e.g. Spouse, Parent, Child"
                    value={form.nomineeRelation}
                    onChange={update('nomineeRelation')}
                  />
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="db-card__title">Personal details</h2>
              <p className="db-card__sub">As they appear on your KYC documents.</p>
              <div className="field">
                <label htmlFor="fullname">Full name</label>
                <input id="fullname" className="input" value={user?.name || ''} disabled />
                <div className="field-hint">Update it any time in Settings.</div>
              </div>
              <div className="db-form__row">
                <div className="field">
                  <label htmlFor="dob">Date of birth</label>
                  <input
                    id="dob"
                    className="input"
                    type="date"
                    min={todayMinus(110)}
                    max={todayMinus(18)}
                    value={form.dob}
                    onChange={update('dob')}
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">Mobile number</label>
                  <input
                    id="phone"
                    className="input"
                    inputMode="numeric"
                    placeholder="10-digit mobile"
                    maxLength={10}
                    value={form.phone}
                    onChange={update('phone')}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="pan">PAN</label>
                <input
                  id="pan"
                  className="input"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  value={form.pan}
                  onChange={update('pan')}
                />
                <div className="field-hint">Five letters, four digits, one letter.</div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="db-card__title">Address &amp; occupation</h2>
              <p className="db-card__sub">Your current residential address.</p>
              <div className="field">
                <label htmlFor="line1">Address line</label>
                <input
                  id="line1"
                  className="input"
                  placeholder="Flat / house, street, area"
                  value={form.line1}
                  onChange={update('line1')}
                />
              </div>
              <div className="db-form__row">
                <div className="field">
                  <label htmlFor="city">City</label>
                  <input id="city" className="input" value={form.city} onChange={update('city')} />
                </div>
                <div className="field">
                  <label htmlFor="state">State</label>
                  <input id="state" className="input" value={form.state} onChange={update('state')} />
                </div>
              </div>
              <div className="db-form__row">
                <div className="field">
                  <label htmlFor="pincode">PIN code</label>
                  <input
                    id="pincode"
                    className="input"
                    inputMode="numeric"
                    placeholder="400001"
                    maxLength={6}
                    value={form.pincode}
                    onChange={update('pincode')}
                  />
                </div>
                <div className="field">
                  <label htmlFor="occupation">Occupation</label>
                  <select
                    id="occupation"
                    className="input db-select"
                    value={form.occupation}
                    onChange={update('occupation')}
                  >
                    {OCCUPATIONS.map((occupation) => (
                      <option key={occupation} value={occupation}>
                        {occupation}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="annualIncome">Annual income</label>
                <select
                  id="annualIncome"
                  className="input db-select"
                  value={form.annualIncome}
                  onChange={update('annualIncome')}
                >
                  <option value="">Select a range</option>
                  {INCOME_BANDS.map((band) => (
                    <option key={band.value} value={band.value}>
                      {band.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="db-card__title">Review &amp; submit</h2>
              <p className="db-card__sub">
                Please check every detail. Applications with mismatched KYC details are rejected.
              </p>
              <dl className="db-kv">
                {reviewRows.map(([label, value]) => (
                  <div className="db-kv__row" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <label className="check check--terms">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>
                  I confirm the details above are true and belong to me, and I agree to the account
                  terms and KYC policy of the bank.
                </span>
              </label>
            </>
          )}

          {error && <div className="db-alert db-alert--error">{error}</div>}

          <div className="db-form__actions">
            {step > 0 && (
              <button type="button" className="db-btn db-btn--outline" onClick={goBack}>
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="db-btn db-btn--primary" onClick={goNext}>
                Continue <ArrowRightIcon />
              </button>
            ) : (
              <button type="submit" className="db-btn db-btn--primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit application'}
                <ArrowRightIcon />
              </button>
            )}
          </div>
        </form>
      </div>
    </AppShell>
  )
}
