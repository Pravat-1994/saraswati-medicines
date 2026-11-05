/**
 * Money helpers. Calculations are carried out in integer paise to avoid
 * floating-point drift, then converted back to rupees with 2-decimal precision.
 */
export const toPaise = (rupees: number): number => Math.round((rupees + Number.EPSILON) * 100)
export const fromPaise = (paise: number): number => Math.round(paise) / 100

/** Round a rupee amount to 2 decimals. */
export const round2 = (value: number): number => fromPaise(toPaise(value))

/** Sum rupee values exactly. */
export const sumMoney = (values: number[]): number => fromPaise(values.reduce((acc, v) => acc + toPaise(v), 0))

/** Percentage of an amount, rounded to paise. */
export const pctOf = (amount: number, pct: number): number => fromPaise(Math.round((toPaise(amount) * pct) / 100))

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrWholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/** ₹1,23,456.78 */
export const formatINR = (value: number): string => inrFormatter.format(round2(value))

/** ₹1,23,457 */
export const formatINRWhole = (value: number): string => inrWholeFormatter.format(Math.round(value))

/** ₹1.2L / ₹3.4Cr / ₹12.5K for KPI tiles and chart axes. */
export function formatINRShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`
  return `${sign}₹${abs.toFixed(0)}`
}

const numberFormatter = new Intl.NumberFormat('en-IN')
export const formatNumber = (value: number): string => numberFormatter.format(value)

export const formatPct = (value: number, digits = 1): string => `${value.toFixed(digits)}%`
