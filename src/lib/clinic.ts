/** Healthcare labels and pure helpers (no React, no data access). */
import { addDays, parseISODate, toISODate } from './dates'
import type {
  AdmissionStatus,
  AdmissionType,
  AppointmentStatus,
  BedStatus,
  ChargeCategory,
  ClinicalEntryKind,
  ConsultationType,
  Doctor,
  DischargeStatus,
  FulfilmentStatus,
  PatientAccount,
  RoomType,
  Vitals,
} from '../types/clinic'
import { round2, sumMoney } from './money'

export const CONSULTATION_TYPE_LABEL: Record<ConsultationType, string> = { VIDEO: 'Video', AUDIO: 'Audio', IN_PERSON: 'In-person' }

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
}

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  GENERAL_WARD: 'General Ward',
  SEMI_PRIVATE: 'Semi-Private Room',
  PRIVATE: 'Private Room',
  EMERGENCY: 'Emergency Room',
  OBSERVATION: 'Observation Room',
}

export const BED_STATUS_LABEL: Record<BedStatus, string> = { AVAILABLE: 'Available', OCCUPIED: 'Occupied', RESERVED: 'Reserved', MAINTENANCE: 'Maintenance' }

export const ADMISSION_TYPE_LABEL: Record<AdmissionType, string> = { EMERGENCY: 'Emergency', PLANNED: 'Planned admission', REFERRAL: 'Doctor referral', OBSERVATION: 'Observation' }

export const ADMISSION_STATUS_LABEL: Record<AdmissionStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  ADMITTED: 'Admitted',
  UNDER_TREATMENT: 'Under treatment',
  DISCHARGE_REQUESTED: 'Discharge requested',
  DISCHARGED: 'Discharged',
  CANCELLED: 'Cancelled',
}

export const DISCHARGE_STATUS_LABEL: Record<DischargeStatus, string> = {
  NOT_REQUESTED: 'Not requested',
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
}

export const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = { PENDING: 'Pending', PARTIALLY_FULFILLED: 'Partially fulfilled', FULFILLED: 'Fulfilled', UNAVAILABLE: 'Unavailable' }

export const CLINICAL_KIND_LABEL: Record<ClinicalEntryKind, string> = {
  ASSESSMENT: 'Initial assessment',
  DOCTOR_NOTE: 'Doctor’s note',
  TREATMENT_PLAN: 'Treatment plan',
  PROGRESS: 'Progress note',
  VITALS: 'Vital signs',
  MEDICATION: 'Medication administered',
  DOCUMENT: 'Document',
  FOLLOW_UP: 'Follow-up instructions',
}

export const CHARGE_CATEGORY_LABEL: Record<ChargeCategory, string> = {
  ADMISSION: 'Admission',
  ROOM: 'Room',
  BED: 'Bed',
  CONSULTATION: 'Consultation',
  TREATMENT: 'Treatment',
  MEDICINE: 'Medicines',
  SERVICE: 'Services & tests',
}

/** Active admissions occupy a bed. */
export const ACTIVE_ADMISSION: AdmissionStatus[] = ['ADMITTED', 'UNDER_TREATMENT', 'DISCHARGE_REQUESTED']

export function ageFrom(dob: string, now: Date = new Date()): number {
  const d = parseISODate(dob)
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return Math.max(0, age)
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const fromMinutes = (mins: number): string => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

export function formatSlot(hhmm: string): string {
  const mins = toMinutes(hhmm)
  const h = Math.floor(mins / 60)
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${((h + 11) % 12) + 1}:${String(mins % 60).padStart(2, '0')} ${suffix}`
}

/** All bookable slots for a doctor on a date (before removing booked ones). */
export function doctorSlots(doctor: Pick<Doctor, 'schedule' | 'slotMinutes'>, date: string): { start: string; end: string }[] {
  const day = parseISODate(date).getDay()
  const out: { start: string; end: string }[] = []
  for (const block of doctor.schedule.filter((s) => s.day === day)) {
    for (let t = toMinutes(block.start); t + doctor.slotMinutes <= toMinutes(block.end); t += doctor.slotMinutes) {
      out.push({ start: fromMinutes(t), end: fromMinutes(t + doctor.slotMinutes) })
    }
  }
  return out
}

/** True when [aStart,aEnd) overlaps [bStart,bEnd). */
export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean => toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)

export function nextDays(count: number, from: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => toISODate(addDays(from, i)))
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Reference ranges for highlighting (adult). Display aid only — not diagnostic. */
export function vitalFlags(v: Vitals): Partial<Record<keyof Vitals, 'high' | 'low'>> {
  const f: Partial<Record<keyof Vitals, 'high' | 'low'>> = {}
  if (v.systolic !== undefined) f.systolic = v.systolic >= 140 ? 'high' : v.systolic < 90 ? 'low' : undefined
  if (v.diastolic !== undefined) f.diastolic = v.diastolic >= 90 ? 'high' : v.diastolic < 60 ? 'low' : undefined
  if (v.heartRate !== undefined) f.heartRate = v.heartRate > 100 ? 'high' : v.heartRate < 60 ? 'low' : undefined
  if (v.temperatureC !== undefined) f.temperatureC = v.temperatureC >= 38 ? 'high' : v.temperatureC < 35.5 ? 'low' : undefined
  if (v.respiratoryRate !== undefined) f.respiratoryRate = v.respiratoryRate > 20 ? 'high' : v.respiratoryRate < 12 ? 'low' : undefined
  if (v.spo2 !== undefined) f.spo2 = v.spo2 < 94 ? 'low' : undefined
  return f
}

export interface AccountTotals {
  charges: number
  tax: number
  discount: number
  net: number
  paid: number
  refunded: number
  balance: number
  byCategory: { category: ChargeCategory; amount: number }[]
}

export function accountTotals(a: Pick<PatientAccount, 'charges' | 'discount' | 'payments'>): AccountTotals {
  const charges = sumMoney(a.charges.map((c) => c.amount))
  const tax = sumMoney(a.charges.map((c) => c.tax))
  const paid = sumMoney(a.payments.filter((p) => p.kind !== 'REFUND').map((p) => p.amount))
  const refunded = sumMoney(a.payments.filter((p) => p.kind === 'REFUND').map((p) => p.amount))
  const net = round2(charges + tax - a.discount)
  const cats = new Map<ChargeCategory, number>()
  a.charges.forEach((c) => cats.set(c.category, (cats.get(c.category) ?? 0) + c.amount + c.tax))
  return {
    charges,
    tax,
    discount: a.discount,
    net,
    paid,
    refunded,
    balance: round2(net - paid + refunded),
    byCategory: [...cats.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })),
  }
}

/** Whole nights between two timestamps (minimum 1). */
export function nightsBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(1, Math.ceil(ms / 86_400_000))
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.length >= 10 ? `+91 ••••• ${d.slice(-5)}` : phone
}
