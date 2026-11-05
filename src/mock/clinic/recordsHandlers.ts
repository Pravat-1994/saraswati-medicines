/** Patients, prescriptions (incl. pharmacy fulfilment) and clinical records. */
import { ACTIVE_ADMISSION, ageFrom } from '../../lib/clinic'
import { isExpired } from '../../lib/inventory'
import { todayISO } from '../../lib/dates'
import { newId } from '../../lib/utils'
import { getActor, requirePermission } from '../../services/core/actor'
import { ServiceError } from '../../types/api'
import type { ClinicalEntry, ClinicalEntryKind, FulfilmentStatus, Patient, Prescription } from '../../types/clinic'
import type {
  ClinicalEntryInput,
  DispenseRecord,
  PatientInput,
  PatientListItem,
  PatientProfile,
  PrescriptionDetail,
  PrescriptionFilters,
  PrescriptionInput,
  PrescriptionItemAvailability,
  PrescriptionView,
} from '../../types/clinicApi'
import { getDb } from '../db'
import { clinicDocNo, getClinicDb, mutateClinic } from '../clinicDb'
import type { ClinicDatabase } from '../clinicSeed'
import { accountView, admissionView, appointmentView, audit, bedLookup, doctorOf, findOr404, patientOf, phoneKey, prescriptionView } from './views'

// ──────────────────────────────── Patients ────────────────────────────────

function listItem(db: ClinicDatabase, p: Patient): PatientListItem {
  const appts = db.appointments.filter((a) => a.patientId === p.id)
  const active = db.admissions.find((a) => a.patientId === p.id && ACTIVE_ADMISSION.includes(a.status))
  const lastVisit = appts.filter((a) => a.status === 'COMPLETED').map((a) => a.date).sort().pop()
  return {
    ...p,
    age: ageFrom(p.dateOfBirth),
    lastVisit,
    activeAdmission: active ? { id: active.id, admissionNo: active.admissionNo, bed: bedLookup(db, active.bedId).bed?.label } : undefined,
    appointmentCount: appts.length,
  }
}

export function listPatients(search?: string): PatientListItem[] {
  requirePermission('patients.view', 'view patients')
  const db = getClinicDb()
  const q = search?.trim().toLowerCase()
  return db.patients
    .filter((p) => !q || `${p.name} ${p.patientCode} ${p.phone.replace(/\s/g, '')} ${p.phone}`.toLowerCase().includes(q.replace(/\s/g, '')) || p.name.toLowerCase().includes(q))
    .map((p) => listItem(db, p))
    .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
}

export function getPatientProfile(id: string): PatientProfile {
  requirePermission('patients.view', 'view patients')
  const db = getClinicDb()
  const p = patientOf(db, id)
  const canClinical = getActor().permissions.includes('clinical.view')
  return {
    patient: listItem(db, p),
    appointments: db.appointments.filter((a) => a.patientId === id).map((a) => appointmentView(db, a)).sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)),
    admissions: db.admissions.filter((a) => a.patientId === id).map((a) => admissionView(db, a)),
    prescriptions: getActor().permissions.includes('prescriptions.view') ? db.prescriptions.filter((r) => r.patientId === id).map((r) => prescriptionView(db, r)) : [],
    accounts: getActor().permissions.includes('billing.view') ? db.accounts.filter((a) => a.patientId === id).map((a) => accountView(db, a)) : [],
    latestVitals: canClinical ? db.clinical.filter((c) => c.patientId === id && c.kind === 'VITALS').sort((a, b) => b.at.localeCompare(a.at))[0] : undefined,
  }
}

/** Possible duplicates: same phone, or same name + date of birth. */
export function findDuplicates(input: Pick<PatientInput, 'name' | 'phone' | 'dateOfBirth'>, excludeId?: string): PatientListItem[] {
  const db = getClinicDb()
  const name = input.name.trim().toLowerCase()
  return db.patients
    .filter((p) => p.id !== excludeId && ((input.phone && phoneKey(p.phone) === phoneKey(input.phone) && p.dateOfBirth === input.dateOfBirth) || (p.name.toLowerCase() === name && p.dateOfBirth === input.dateOfBirth)))
    .map((p) => listItem(db, p))
}

function validatePatient(input: PatientInput) {
  if (input.name.trim().length < 2) throw new ServiceError('Enter the patient’s full name.', 'VALIDATION', 422)
  if (phoneKey(input.phone).length !== 10) throw new ServiceError('Enter a valid 10-digit mobile number.', 'VALIDATION', 422)
  if (!input.dateOfBirth || input.dateOfBirth > todayISO()) throw new ServiceError('Enter a valid date of birth.', 'VALIDATION', 422)
}

export function registerPatient(input: PatientInput, confirmDuplicate = false): Patient {
  requirePermission('patients.manage', 'register patients')
  validatePatient(input)
  return mutateClinic((db) => {
    const dupes = findDuplicates(input)
    if (dupes.length && !confirmDuplicate) {
      throw new ServiceError(`Possible duplicate: ${dupes.map((d) => `${d.name} (${d.patientCode})`).join(', ')}. Open the existing record or confirm this is a different person.`, 'DUPLICATE', 409, dupes.map((d) => d.id))
    }
    const p: Patient = {
      ...input,
      name: input.name.trim(),
      email: input.email?.trim() || undefined,
      id: newId('pat'),
      patientCode: clinicDocNo(db, 'patient', 'SMP').replace(/\/\d{2}-\d{2}\//, '-'),
      registeredAt: new Date().toISOString(),
      registeredBy: getActor().name,
    }
    db.patients.unshift(p)
    return p
  })
}

export function updatePatient(id: string, input: PatientInput): Patient {
  requirePermission('patients.manage', 'edit patients')
  validatePatient(input)
  return mutateClinic((db) => {
    const p = patientOf(db, id)
    Object.assign(p, input, { name: input.name.trim(), email: input.email?.trim() || undefined })
    return p
  })
}

// ───────────────────────────── Prescriptions ──────────────────────────────

function requireDoctorAuthority(): { doctorId: string } {
  requirePermission('prescriptions.issue', 'issue prescriptions')
  const actor = getActor()
  if (actor.roleId !== 'DOCTOR' || !actor.doctorId) throw new ServiceError('Only registered doctors can create or approve prescriptions.', 'FORBIDDEN', 403)
  return { doctorId: actor.doctorId }
}

export function listPrescriptions(f: PrescriptionFilters = {}): PrescriptionView[] {
  requirePermission('prescriptions.view', 'view prescriptions')
  const db = getClinicDb()
  const actor = getActor()
  const q = f.search?.trim().toLowerCase()
  return db.prescriptions
    // Drafts are visible only to their author.
    .filter((r) => r.status === 'FINAL' || r.doctorId === actor.doctorId)
    .filter((r) => !f.mine || r.doctorId === actor.doctorId)
    .filter((r) => !f.status || f.status === 'ALL' || r.status === f.status)
    .filter((r) => !f.fulfilment || f.fulfilment === 'ALL' || r.fulfilment === f.fulfilment)
    .filter((r) => !f.doctorId || r.doctorId === f.doctorId)
    .filter((r) => !f.patientId || r.patientId === f.patientId)
    .map((r) => prescriptionView(db, r))
    .filter((r) => !q || `${r.rxNo} ${r.patientName} ${r.patientCode} ${r.doctorName} ${r.diagnosis} ${r.items.map((i) => i.medicineName).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function availabilityFor(r: Prescription): PrescriptionItemAvailability[] {
  const pharmacy = getDb()
  return r.items.map((i) => {
    const med = i.medicineId ? pharmacy.medicines.find((m) => m.id === i.medicineId && m.isActive) : undefined
    const available = med ? pharmacy.batches.filter((b) => b.medicineId === med.id && b.quantity > 0 && !isExpired(b)).reduce((a, b) => a + b.quantity, 0) : 0
    const pending = Math.max(0, i.quantity - i.dispensedQty)
    return { itemId: i.id, medicineId: med?.id, stocked: !!med, available, pending, dispensable: Math.min(pending, available), prescriptionRequired: med?.prescriptionRequired ?? true }
  })
}

function recomputeFulfilment(r: Prescription): FulfilmentStatus {
  const dispensed = r.items.reduce((a, i) => a + Math.min(i.dispensedQty, i.quantity), 0)
  const total = r.items.reduce((a, i) => a + i.quantity, 0)
  if (total > 0 && dispensed >= total) return 'FULFILLED'
  if (dispensed > 0) return 'PARTIALLY_FULFILLED'
  return availabilityFor(r).every((x) => x.dispensable === 0) ? 'UNAVAILABLE' : 'PENDING'
}

export function getPrescription(id: string): PrescriptionDetail {
  requirePermission('prescriptions.view', 'view prescriptions')
  const db = getClinicDb()
  const r = findOr404(db.prescriptions, id, 'Prescription')
  if (r.status === 'DRAFT' && r.doctorId !== getActor().doctorId) throw new ServiceError('Draft prescriptions are visible only to the prescribing doctor.', 'FORBIDDEN', 403)
  const admission = db.admissions.find((a) => a.patientId === r.patientId && ACTIVE_ADMISSION.includes(a.status))
  const account = admission?.accountId ? db.accounts.find((a) => a.id === admission.accountId) : undefined
  const view = prescriptionView(db, r)
  if (r.status === 'FINAL' && r.fulfilment !== 'FULFILLED' && r.fulfilment !== 'PARTIALLY_FULFILLED') view.fulfilment = recomputeFulfilment(r)
  return {
    prescription: view,
    patient: patientOf(db, r.patientId),
    doctor: doctorOf(db, r.doctorId),
    availability: availabilityFor(r),
    activeAdmission: admission ? { id: admission.id, admissionNo: admission.admissionNo, accountId: account?.id, accountNo: account?.accountNo } : undefined,
  }
}

function validateRx(input: PrescriptionInput) {
  if (!input.diagnosis.trim()) throw new ServiceError('Diagnosis is required.', 'VALIDATION', 422)
  if (input.items.length === 0) throw new ServiceError('Add at least one medicine.', 'VALIDATION', 422)
  for (const i of input.items) {
    if (!i.medicineName.trim() || !i.dosage.trim() || !i.frequency.trim() || !i.duration.trim()) throw new ServiceError('Each medicine needs a name, dosage, frequency and duration.', 'VALIDATION', 422)
    if (!Number.isInteger(i.quantity) || i.quantity < 1) throw new ServiceError(`Enter a quantity to dispense for ${i.medicineName}.`, 'VALIDATION', 422)
  }
}

export function savePrescriptionDraft(input: PrescriptionInput, id?: string): PrescriptionView {
  const { doctorId } = requireDoctorAuthority()
  validateRx(input)
  return mutateClinic((db) => {
    patientOf(db, input.patientId)
    const now = new Date().toISOString()
    const items = input.items.map((i) => ({ ...i, id: newId('rxi'), dispensedQty: 0 }))
    if (id) {
      const r = findOr404(db.prescriptions, id, 'Prescription')
      if (r.doctorId !== doctorId) throw new ServiceError('You can only edit your own prescriptions.', 'FORBIDDEN', 403)
      if (r.status !== 'DRAFT') throw new ServiceError('Finalised prescriptions cannot be edited. Create a new prescription instead.', 'INVALID_STATE', 409)
      Object.assign(r, { ...input, items, updatedAt: now })
      r.history.push(audit(getActor().name, 'Draft updated'))
      return prescriptionView(db, r)
    }
    const r: Prescription = {
      ...input,
      id: newId('rx'),
      rxNo: clinicDocNo(db, 'rx', 'RX'),
      doctorId,
      items,
      createdAt: now,
      updatedAt: now,
      status: 'DRAFT',
      fulfilment: 'PENDING',
      saleIds: [],
      history: [audit(getActor().name, 'Draft created')],
    }
    db.prescriptions.unshift(r)
    return prescriptionView(db, r)
  })
}

/** Doctor signs the prescription: records name + registration no. + timestamp. */
export function finalisePrescription(id: string, confirmName: string): PrescriptionView {
  const { doctorId } = requireDoctorAuthority()
  return mutateClinic((db) => {
    const r = findOr404(db.prescriptions, id, 'Prescription')
    const doctor = doctorOf(db, doctorId)
    if (r.doctorId !== doctorId) throw new ServiceError('Only the prescribing doctor can finalise this prescription.', 'FORBIDDEN', 403)
    if (r.status !== 'DRAFT') throw new ServiceError('Already finalised.', 'INVALID_STATE', 409)
    if (confirmName.trim().toLowerCase() !== doctor.name.toLowerCase()) throw new ServiceError(`Type your name exactly as “${doctor.name}” to sign.`, 'VALIDATION', 422)
    const now = new Date().toISOString()
    r.status = 'FINAL'
    r.signature = { name: doctor.name, registrationNo: doctor.registrationNo, signedAt: now, userId: getActor().id }
    r.updatedAt = now
    r.fulfilment = recomputeFulfilment(r)
    r.history.push(audit(doctor.name, 'Finalised & signed'))
    return prescriptionView(db, r)
  })
}

export function deletePrescriptionDraft(id: string): void {
  const { doctorId } = requireDoctorAuthority()
  mutateClinic((db) => {
    const r = findOr404(db.prescriptions, id, 'Prescription')
    if (r.doctorId !== doctorId || r.status !== 'DRAFT') throw new ServiceError('Only your own drafts can be deleted.', 'FORBIDDEN', 403)
    db.prescriptions = db.prescriptions.filter((x) => x.id !== id)
  })
}

/** Called after the pharmacy bills prescribed medicines at the POS. */
export function recordDispense(rec: DispenseRecord): PrescriptionView {
  requirePermission('prescriptions.fulfil', 'dispense prescriptions')
  return mutateClinic((db) => {
    const r = findOr404(db.prescriptions, rec.prescriptionId, 'Prescription')
    if (r.status !== 'FINAL') throw new ServiceError('Only finalised prescriptions can be dispensed.', 'INVALID_STATE', 409)
    for (const line of rec.lines) {
      const item = r.items.find((i) => i.medicineId === line.medicineId && i.dispensedQty < i.quantity)
      if (!item) continue
      item.dispensedQty = Math.min(item.quantity, item.dispensedQty + line.quantity)
    }
    if (!r.saleIds.includes(rec.saleId)) r.saleIds.push(rec.saleId)
    r.fulfilment = recomputeFulfilment(r)
    r.history.push(audit(getActor().name, 'Dispensed', `Invoice ${rec.invoiceNumber}`))
    return prescriptionView(db, r)
  })
}

// ───────────────────────────── Clinical records ───────────────────────────

const NOTE_KINDS: ClinicalEntryKind[] = ['ASSESSMENT', 'DOCTOR_NOTE', 'TREATMENT_PLAN', 'FOLLOW_UP']

export function listClinical(patientId: string, admissionId?: string, kinds?: ClinicalEntryKind[]): ClinicalEntry[] {
  requirePermission('clinical.view', 'view clinical records')
  const db = getClinicDb()
  return db.clinical
    .filter((c) => c.patientId === patientId && (!admissionId || c.admissionId === admissionId) && (!kinds || kinds.includes(c.kind)))
    .sort((a, b) => b.at.localeCompare(a.at))
}

export function addClinicalEntry(input: ClinicalEntryInput): ClinicalEntry {
  if (NOTE_KINDS.includes(input.kind)) requirePermission('clinical.notes', 'write doctor notes and treatment plans')
  else requirePermission('clinical.record', 'record clinical observations')
  if (input.kind === 'VITALS') {
    const v = input.vitals ?? {}
    if (Object.values(v).every((x) => x === undefined || Number.isNaN(x))) throw new ServiceError('Record at least one vital sign.', 'VALIDATION', 422)
    const bad = (x: number | undefined, lo: number, hi: number) => x !== undefined && (x < lo || x > hi)
    if (bad(v.systolic, 50, 260) || bad(v.diastolic, 30, 160) || bad(v.heartRate, 20, 250) || bad(v.temperatureC, 30, 45) || bad(v.respiratoryRate, 4, 70) || bad(v.spo2, 50, 100) || bad(v.weightKg, 0.5, 300)) {
      throw new ServiceError('One of the readings is outside a plausible range — please re-check.', 'VALIDATION', 422)
    }
  } else if (input.kind === 'MEDICATION') {
    if (!input.medication?.name.trim() || !input.medication.dose.trim()) throw new ServiceError('Medicine name and dose are required.', 'VALIDATION', 422)
  } else if (input.kind === 'DOCUMENT') {
    if (!input.file) throw new ServiceError('Attach a document.', 'VALIDATION', 422)
  } else if (!input.text?.trim()) throw new ServiceError('Write the note before saving.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    patientOf(db, input.patientId)
    if (input.admissionId) {
      const a = findOr404(db.admissions, input.admissionId, 'Admission')
      if (!ACTIVE_ADMISSION.includes(a.status)) throw new ServiceError('Entries can only be added to active admissions.', 'INVALID_STATE', 409)
    }
    const actor = getActor()
    const now = new Date().toISOString()
    const entry: ClinicalEntry = {
      id: newId('cli'),
      patientId: input.patientId,
      admissionId: input.admissionId,
      kind: input.kind,
      at: now,
      by: actor.name,
      byRole: actor.roleId === 'DOCTOR' ? 'Doctor' : actor.roleId === 'NURSE' ? 'Nurse' : actor.roleId,
      title: input.title,
      text: input.text?.trim(),
      vitals: input.vitals,
      medication: input.medication,
      file: input.file ? { ...input.file, uploadedAt: now, uploadedBy: actor.name } : undefined,
    }
    db.clinical.push(entry)
    // First clinical entry moves an admitted patient into treatment.
    if (input.admissionId) {
      const a = db.admissions.find((x) => x.id === input.admissionId)!
      if (a.status === 'ADMITTED') {
        a.status = 'UNDER_TREATMENT'
        a.history.push(audit(actor.name, 'Treatment started'))
      }
    }
    return entry
  })
}
