const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// The API sends integer minor units (paise). 25050 -> ₹250.50.
export const formatMinor = (minor = 0) => inr.format(minor / 100)

// "250.50" -> 25050. Returns null for empty, zero, negative or badly formed input.
export const toMinorUnits = (value) => {
  const raw = String(value ?? '').trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null
  const [whole, fraction = ''] = raw.split('.')
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null
}
