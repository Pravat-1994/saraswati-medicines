/** Shared Indian contact validation for customer / supplier / user forms. */
import { z } from 'zod'

const digits = (v: string) => v.replace(/\D/g, '')

/** Accepts 10-digit mobile/landline numbers, optionally prefixed with +91 / 91 / 0. */
export function isValidIndianPhone(v: string): boolean {
  const d = digits(v)
  if (d.length === 10) return true
  if (d.length === 12 && d.startsWith('91')) return true
  if (d.length === 11 && d.startsWith('0')) return true
  return false
}

/** Normalises to "+91 XXXXX XXXXX". */
export function formatIndianPhone(v: string): string {
  const d = digits(v).slice(-10)
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : v.trim()
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .refine(isValidIndianPhone, 'Enter a valid 10-digit phone number (optionally with +91)')

export const optionalEmailSchema = z
  .string()
  .trim()
  .refine((v) => !v || EMAIL_REGEX.test(v), 'Enter a valid email address')

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GSTIN_REGEX, 'Enter a valid 15-character GSTIN (e.g. 21AAKFK4512L1Z8)')

export const pincodeSchema = z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code')

export const blankToUndefined = (v?: string): string | undefined => (v && v.trim() ? v.trim() : undefined)
