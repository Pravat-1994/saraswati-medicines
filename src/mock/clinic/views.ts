/** View builders shared by the healthcare mock handlers. */
import { accountTotals, ageFrom, nightsBetween } from '../../lib/clinic'
import { ServiceError } from '../../types/api'
import type { Admission, Appointment, Bed, Doctor, Patient, PatientAccount, Prescription, Room } from '../../types/clinic'
import type { AccountView, AdmissionView, AppointmentView, BedView, PrescriptionView } from '../../types/clinicApi'
import type { ClinicDatabase } from '../clinicSeed'

export function findOr404<T extends { id: string }>(items: T[], id: string, label: string): T {
  const x = items.find((i) => i.id === id)
  if (!x) throw new ServiceError(`${label} not found.`, 'NOT_FOUND', 404)
  return x
}

export const patientOf = (db: ClinicDatabase, id: string): Patient => findOr404(db.patients, id, 'Patient')
export const doctorOf = (db: ClinicDatabase, id: string): Doctor => findOr404(db.doctors, id, 'Doctor')

export function appointmentView(db: ClinicDatabase, a: Appointment): AppointmentView {
  const p = db.patients.find((x) => x.id === a.patientId)
  const d = db.doctors.find((x) => x.id === a.doctorId)
  return { ...a, patientName: p?.name ?? 'Unknown', patientCode: p?.patientCode ?? '', doctorName: d?.name ?? 'Unknown', specialization: d?.specialization ?? '' }
}

export function prescriptionView(db: ClinicDatabase, r: Prescription): PrescriptionView {
  const p = db.patients.find((x) => x.id === r.patientId)
  const d = db.doctors.find((x) => x.id === r.doctorId)
  return { ...r, patientName: p?.name ?? 'Unknown', patientCode: p?.patientCode ?? '', doctorName: d?.name ?? 'Unknown', specialization: d?.specialization ?? '' }
}

export function bedLookup(db: ClinicDatabase, bedId?: string): { bed?: Bed; room?: Room } {
  if (!bedId) return {}
  for (const room of db.rooms) {
    const bed = room.beds.find((b) => b.id === bedId)
    if (bed) return { bed, room }
  }
  return {}
}

export function admissionView(db: ClinicDatabase, a: Admission): AdmissionView {
  const p = db.patients.find((x) => x.id === a.patientId)
  const d = db.doctors.find((x) => x.id === a.doctorId)
  const { bed, room } = bedLookup(db, a.bedId)
  return {
    ...a,
    patientName: p?.name ?? 'Unknown',
    patientCode: p?.patientCode ?? '',
    patientAge: p ? ageFrom(p.dateOfBirth) : 0,
    patientGender: p?.gender ?? 'OTHER',
    doctorName: d?.name ?? 'Unknown',
    roomNumber: room?.number,
    bedLabel: bed?.label,
    roomType: room?.type,
    lengthOfStayDays: a.admittedAt ? nightsBetween(a.admittedAt, a.discharge.completedAt ?? new Date().toISOString()) : undefined,
  }
}

export function bedView(db: ClinicDatabase, room: Room, bed: Bed): BedView {
  const adm = bed.admissionId ? db.admissions.find((a) => a.id === bed.admissionId) : undefined
  const p = adm ? db.patients.find((x) => x.id === adm.patientId) : undefined
  return {
    ...bed,
    roomNumber: room.number,
    roomType: room.type,
    department: room.department,
    dailyRate: room.dailyRate,
    patientName: p?.name,
    patientCode: p?.patientCode,
    admissionNo: adm?.admissionNo,
    since: adm?.admittedAt ?? adm?.requestedAt,
  }
}

export function accountView(db: ClinicDatabase, acc: PatientAccount): AccountView {
  const p = db.patients.find((x) => x.id === acc.patientId)
  const adm = acc.admissionId ? db.admissions.find((a) => a.id === acc.admissionId) : undefined
  const apt = acc.appointmentId ? db.appointments.find((a) => a.id === acc.appointmentId) : undefined
  let accruedRoom: AccountView['accruedRoom']
  if (acc.status === 'OPEN' && adm?.admittedAt && !acc.charges.some((c) => c.category === 'ROOM' && c.auto)) {
    const { room } = bedLookup(db, adm.bedId)
    if (room) {
      const nights = nightsBetween(adm.admittedAt, new Date().toISOString())
      accruedRoom = { nights, rate: room.dailyRate, amount: nights * room.dailyRate, roomNumber: room.number }
    }
  }
  return {
    ...acc,
    patientName: p?.name ?? 'Unknown',
    patientCode: p?.patientCode ?? '',
    admissionNo: adm?.admissionNo,
    appointmentNo: apt?.appointmentNo,
    totals: accountTotals(acc),
    accruedRoom,
  }
}

export function audit(by: string, action: string, note?: string) {
  return { at: new Date().toISOString(), by, action, note }
}

export const phoneKey = (p: string) => p.replace(/\D/g, '').slice(-10)
