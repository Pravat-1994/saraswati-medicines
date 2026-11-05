/** Admissions, rooms & beds, discharge and patient billing. */
import { ACTIVE_ADMISSION, accountTotals, nightsBetween } from '../../lib/clinic'
import { addDays, toISODate, todayISO } from '../../lib/dates'
import { round2 } from '../../lib/money'
import { newId } from '../../lib/utils'
import { getActor, requirePermission } from '../../services/core/actor'
import { ServiceError } from '../../types/api'
import type { Admission, Bed, BedStatus, PatientAccount, PatientCharge, Room } from '../../types/clinic'
import type {
  AccountFilters,
  AccountView,
  AdmissionDetail,
  AdmissionFilters,
  AdmissionRequestInput,
  AdmissionView,
  BedSummary,
  ChargeInput,
  DischargeInput,
  InpatientDashboard,
  PaymentInput,
  RoomView,
} from '../../types/clinicApi'
import { clinicDocNo, getClinicDb, mutateClinic } from '../clinicDb'
import type { ClinicDatabase } from '../clinicSeed'
import { accountView, admissionView, audit, bedLookup, bedView, doctorOf, findOr404, patientOf, prescriptionView } from './views'

// ───────────────────────────── Rooms & beds ───────────────────────────────

function roomView(db: ClinicDatabase, r: Room): RoomView {
  const counts: Record<BedStatus, number> = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0 }
  r.beds.forEach((b) => counts[b.status]++)
  return { ...r, beds: r.beds.map((b) => bedView(db, r, b)), counts }
}

export function listRooms(): RoomView[] {
  requirePermission('beds.view', 'view rooms and beds')
  const db = getClinicDb()
  return db.rooms.map((r) => roomView(db, r))
}

function summary(db: ClinicDatabase): BedSummary {
  const beds = db.rooms.flatMap((r) => r.beds.map((b) => ({ ...b, type: r.type })))
  const types = [...new Set(db.rooms.map((r) => r.type))]
  return {
    total: beds.length,
    available: beds.filter((b) => b.status === 'AVAILABLE').length,
    occupied: beds.filter((b) => b.status === 'OCCUPIED').length,
    reserved: beds.filter((b) => b.status === 'RESERVED').length,
    maintenance: beds.filter((b) => b.status === 'MAINTENANCE').length,
    byType: types.map((type) => ({ type, total: beds.filter((b) => b.type === type).length, available: beds.filter((b) => b.type === type && b.status === 'AVAILABLE').length })),
  }
}

export const bedSummary = (): BedSummary => summary(getClinicDb())

function findBed(db: ClinicDatabase, bedId: string): { bed: Bed; room: Room } {
  const { bed, room } = bedLookup(db, bedId)
  if (!bed || !room) throw new ServiceError('Bed not found.', 'NOT_FOUND', 404)
  return { bed, room }
}

/** Take a free bed out of service or return it to service. */
export function setBedMaintenance(bedId: string, maintenance: boolean, note?: string): Bed {
  requirePermission('beds.manage', 'manage beds')
  return mutateClinic((db) => {
    const { bed } = findBed(db, bedId)
    if (bed.status === 'OCCUPIED' || bed.status === 'RESERVED') throw new ServiceError('This bed is allocated to a patient — transfer or discharge the patient first.', 'INVALID_STATE', 409)
    bed.status = maintenance ? 'MAINTENANCE' : 'AVAILABLE'
    bed.note = maintenance ? note?.trim() || 'Under maintenance' : undefined
    return bed
  })
}

// ───────────────────────────── Admissions ─────────────────────────────────

export function listAdmissions(f: AdmissionFilters = {}): AdmissionView[] {
  requirePermission('admissions.view', 'view admissions')
  const db = getClinicDb()
  const actor = getActor()
  const q = f.search?.trim().toLowerCase()
  return db.admissions
    .filter((a) => !f.status || f.status === 'ALL' || (f.status === 'ACTIVE' ? ACTIVE_ADMISSION.includes(a.status) : a.status === f.status))
    .filter((a) => !f.department || a.department === f.department)
    .filter((a) => !f.doctorId || a.doctorId === f.doctorId)
    .filter((a) => !f.mine || a.doctorId === actor.doctorId)
    .filter((a) => !f.from || (a.admittedAt ?? a.requestedAt).slice(0, 10) >= f.from)
    .filter((a) => !f.to || (a.admittedAt ?? a.requestedAt).slice(0, 10) <= f.to)
    .map((a) => admissionView(db, a))
    .filter((a) => !f.roomType || a.roomType === f.roomType)
    .filter((a) => !q || `${a.admissionNo} ${a.patientName} ${a.patientCode} ${a.doctorName} ${a.bedLabel ?? ''} ${a.diagnosis}`.toLowerCase().includes(q))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
}

export function getAdmission(id: string): AdmissionDetail {
  requirePermission('admissions.view', 'view admissions')
  const db = getClinicDb()
  const a = findOr404(db.admissions, id, 'Admission')
  const { bed, room } = bedLookup(db, a.bedId)
  const acc = a.accountId ? db.accounts.find((x) => x.id === a.accountId) : undefined
  const perms = getActor().permissions
  return {
    admission: admissionView(db, a),
    patient: patientOf(db, a.patientId),
    doctor: doctorOf(db, a.doctorId),
    bed: bed && room ? bedView(db, room, bed) : undefined,
    account: acc && perms.includes('billing.view') ? accountView(db, acc) : undefined,
    clinical: perms.includes('clinical.view') ? db.clinical.filter((c) => c.admissionId === a.id).sort((x, y) => y.at.localeCompare(x.at)) : [],
    prescriptions: perms.includes('prescriptions.view') ? db.prescriptions.filter((r) => r.admissionId === a.id || (r.patientId === a.patientId && r.status === 'FINAL' && r.createdAt >= a.requestedAt)).map((r) => prescriptionView(db, r)) : [],
  }
}

export function requestAdmission(input: AdmissionRequestInput): AdmissionView {
  requirePermission('admissions.manage', 'request admissions')
  if (!input.reason.trim()) throw new ServiceError('Record the reason for admission.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    const p = patientOf(db, input.patientId)
    doctorOf(db, input.doctorId)
    const open = db.admissions.find((a) => a.patientId === p.id && ['REQUESTED', 'APPROVED', ...ACTIVE_ADMISSION].includes(a.status))
    if (open) throw new ServiceError(`${p.name} already has an open admission (${open.admissionNo}).`, 'CONFLICT', 409)
    const a: Admission = {
      id: newId('adm'),
      admissionNo: clinicDocNo(db, 'admission', 'IPD'),
      patientId: p.id,
      doctorId: input.doctorId,
      requestedAt: new Date().toISOString(),
      requestedBy: getActor().name,
      expectedDischarge: input.expectedDischarge,
      reason: input.reason.trim(),
      diagnosis: input.diagnosis.trim(),
      type: input.type,
      department: input.department,
      preferredRoomType: input.preferredRoomType,
      attendant: input.attendant?.name ? input.attendant : undefined,
      initialObservations: input.initialObservations.trim(),
      status: input.type === 'EMERGENCY' ? 'APPROVED' : 'REQUESTED',
      bedHistory: [],
      discharge: { status: 'NOT_REQUESTED' },
      history: [audit(getActor().name, 'Admission requested', input.reason.trim())],
    }
    if (a.status === 'APPROVED') a.history.push(audit('System', 'Auto-approved', 'Emergency admission — clinical approval to be recorded by the admitting doctor'))
    db.admissions.unshift(a)
    return admissionView(db, a)
  })
}

export function approveAdmission(id: string): AdmissionView {
  requirePermission('admissions.approve', 'approve admissions')
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, id, 'Admission')
    if (a.status !== 'REQUESTED') throw new ServiceError('Only requested admissions can be approved.', 'INVALID_STATE', 409)
    a.status = 'APPROVED'
    a.history.push(audit(getActor().name, 'Approved'))
    return admissionView(db, a)
  })
}

/** Allocates (reserves) a bed for an approved admission, or moves the reservation. */
export function allocateBed(admissionId: string, bedId: string): AdmissionView {
  requirePermission('beds.manage', 'allocate beds')
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, admissionId, 'Admission')
    if (a.status !== 'APPROVED') throw new ServiceError('Approve the admission before allocating a bed. To move an admitted patient, use Transfer.', 'INVALID_STATE', 409)
    const { bed } = findBed(db, bedId)
    if (bed.status !== 'AVAILABLE') throw new ServiceError('That bed is not available.', 'BED_UNAVAILABLE', 409)
    if (a.bedId) {
      const prev = findBed(db, a.bedId).bed
      if (prev.admissionId === a.id && prev.status === 'RESERVED') {
        prev.status = 'AVAILABLE'
        prev.admissionId = undefined
      }
    }
    bed.status = 'RESERVED'
    bed.admissionId = a.id
    a.bedId = bed.id
    a.roomId = bed.roomId
    a.history.push(audit(getActor().name, 'Bed allocated', bed.label))
    return admissionView(db, a)
  })
}

function openAccount(db: ClinicDatabase, a: Admission, by: string): PatientAccount {
  const now = new Date().toISOString()
  const acc: PatientAccount = {
    id: newId('acc'),
    accountNo: clinicDocNo(db, 'account', 'PA'),
    patientId: a.patientId,
    admissionId: a.id,
    openedAt: now,
    charges: [{ id: newId('chg'), date: now, category: 'ADMISSION', description: 'Admission & registration', quantity: 1, rate: db.settings.admissionCharge, taxRate: 0, amount: db.settings.admissionCharge, tax: 0, addedBy: by, auto: true }],
    discount: 0,
    payments: [],
    status: 'OPEN',
  }
  db.accounts.push(acc)
  a.accountId = acc.id
  return acc
}

/** Confirms the admission: bed becomes occupied and the inpatient record + account are created. */
export function confirmAdmission(id: string): AdmissionView {
  requirePermission('admissions.manage', 'confirm admissions')
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, id, 'Admission')
    if (a.status !== 'APPROVED') throw new ServiceError('Only approved admissions can be confirmed.', 'INVALID_STATE', 409)
    if (!a.bedId) throw new ServiceError('Allocate a bed before confirming the admission.', 'VALIDATION', 422)
    const { bed } = findBed(db, a.bedId)
    if (bed.admissionId !== a.id || bed.status !== 'RESERVED') throw new ServiceError('The allocated bed is no longer reserved for this patient — allocate again.', 'BED_UNAVAILABLE', 409)
    const now = new Date().toISOString()
    bed.status = 'OCCUPIED'
    a.status = 'ADMITTED'
    a.admittedAt = now
    a.bedHistory.push({ bedId: bed.id, roomId: bed.roomId, from: now, reason: 'Initial allocation', by: getActor().name })
    if (!a.accountId) openAccount(db, a, getActor().name)
    a.history.push(audit(getActor().name, 'Admitted', `Bed ${bed.label}`))
    return admissionView(db, a)
  })
}

export function transferBed(id: string, bedId: string, reason: string): AdmissionView {
  requirePermission('beds.manage', 'transfer beds')
  if (!reason.trim()) throw new ServiceError('Give a reason for the transfer.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, id, 'Admission')
    if (!ACTIVE_ADMISSION.includes(a.status) || !a.bedId) throw new ServiceError('Only admitted patients can be transferred.', 'INVALID_STATE', 409)
    const target = findBed(db, bedId)
    if (target.bed.status !== 'AVAILABLE') throw new ServiceError('The destination bed is not available.', 'BED_UNAVAILABLE', 409)
    const from = findBed(db, a.bedId)
    const now = new Date().toISOString()
    // Post room charges for the nights spent in the previous room before moving.
    const current = a.bedHistory.find((h) => !h.to)
    if (current && a.accountId && from.room.id !== target.room.id) {
      const acc = db.accounts.find((x) => x.id === a.accountId)
      const nights = nightsBetween(current.from, now)
      acc?.charges.push({ id: newId('chg'), date: now, category: 'ROOM', description: `Room ${from.room.number} — ${nights} night(s) (before transfer)`, quantity: nights, rate: from.room.dailyRate, taxRate: 0, amount: nights * from.room.dailyRate, tax: 0, addedBy: 'System', auto: true })
    }
    if (current) current.to = now
    from.bed.status = 'AVAILABLE'
    from.bed.admissionId = undefined
    target.bed.status = 'OCCUPIED'
    target.bed.admissionId = a.id
    a.bedId = target.bed.id
    a.roomId = target.room.id
    a.bedHistory.push({ bedId: target.bed.id, roomId: target.room.id, from: now, reason: reason.trim(), by: getActor().name })
    a.history.push(audit(getActor().name, 'Bed transfer', `${from.bed.label} → ${target.bed.label}: ${reason.trim()}`))
    return admissionView(db, a)
  })
}

export function cancelAdmission(id: string, reason: string): AdmissionView {
  requirePermission('admissions.manage', 'cancel admissions')
  if (!reason.trim()) throw new ServiceError('Give a reason for cancelling.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, id, 'Admission')
    if (!['REQUESTED', 'APPROVED'].includes(a.status)) throw new ServiceError('Admitted patients must be discharged, not cancelled.', 'INVALID_STATE', 409)
    if (a.bedId) {
      const { bed } = findBed(db, a.bedId)
      if (bed.admissionId === a.id) {
        bed.status = 'AVAILABLE'
        bed.admissionId = undefined
      }
    }
    a.status = 'CANCELLED'
    a.cancelReason = reason.trim()
    a.history.push(audit(getActor().name, 'Cancelled', reason.trim()))
    return admissionView(db, a)
  })
}

export function inpatientDashboard(f: { department?: string; doctorId?: string; roomType?: string } = {}): InpatientDashboard {
  requirePermission('admissions.view', 'view the inpatient dashboard')
  const db = getClinicDb()
  const all = db.admissions.map((a) => admissionView(db, a)).filter((a) => (!f.department || a.department === f.department) && (!f.doctorId || a.doctorId === f.doctorId) && (!f.roomType || a.roomType === f.roomType))
  const active = all.filter((a) => ACTIVE_ADMISSION.includes(a.status))
  const beds = summary(db)
  const today = todayISO()
  const trend = Array.from({ length: 14 }, (_, i) => toISODate(addDays(new Date(), i - 13))).map((date) => ({
    date,
    admissions: all.filter((a) => a.admittedAt?.slice(0, 10) === date).length,
    discharges: all.filter((a) => a.discharge.completedAt?.slice(0, 10) === date).length,
  }))
  const deps = new Map<string, number>()
  active.forEach((a) => deps.set(a.department, (deps.get(a.department) ?? 0) + 1))
  return {
    admitted: active.length,
    underTreatment: active.filter((a) => a.status === 'UNDER_TREATMENT').length,
    pendingRequests: all.filter((a) => a.status === 'REQUESTED' || a.status === 'APPROVED').length,
    awaitingDischarge: active.filter((a) => a.status === 'DISCHARGE_REQUESTED' || ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(a.discharge.status)).length,
    beds,
    occupancyPct: beds.total - beds.maintenance > 0 ? Math.round(((beds.occupied + beds.reserved) / (beds.total - beds.maintenance)) * 100) : 0,
    recentAdmissions: all.filter((a) => a.admittedAt).sort((a, b) => (b.admittedAt ?? '').localeCompare(a.admittedAt ?? '')).slice(0, 6),
    expectedDischarges: active.filter((a) => a.expectedDischarge && a.expectedDischarge <= toISODate(addDays(new Date(), 2))).sort((a, b) => (a.expectedDischarge ?? '').localeCompare(b.expectedDischarge ?? '')),
    byDepartment: [...deps.entries()].map(([department, patients]) => ({ department, patients })).sort((a, b) => b.patients - a.patients),
    admissionsTrend: trend.map((t) => ({ ...t, date: t.date === today ? t.date : t.date })),
  }
}

// ───────────────────────────── Discharge ──────────────────────────────────

export function listDischarges(status?: string): AdmissionView[] {
  requirePermission('admissions.view', 'view discharges')
  const db = getClinicDb()
  return db.admissions
    .filter((a) => (status && status !== 'ALL' ? a.discharge.status === status : a.discharge.status !== 'NOT_REQUESTED' || ACTIVE_ADMISSION.includes(a.status)))
    .map((a) => admissionView(db, a))
    .sort((a, b) => (b.discharge.requestedAt ?? b.requestedAt).localeCompare(a.discharge.requestedAt ?? a.requestedAt))
}

export function requestDischarge(id: string, note?: string): AdmissionView {
  requirePermission('discharge.request', 'request discharge')
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, id, 'Admission')
    if (!['ADMITTED', 'UNDER_TREATMENT'].includes(a.status)) throw new ServiceError('Discharge can only be requested for admitted patients.', 'INVALID_STATE', 409)
    a.status = 'DISCHARGE_REQUESTED'
    a.discharge = { ...a.discharge, status: 'REQUESTED', requestedAt: new Date().toISOString(), requestedBy: getActor().name }
    a.history.push(audit(getActor().name, 'Discharge requested', note))
    return admissionView(db, a)
  })
}

/** Doctor drafts the discharge summary (moves to Under review). */
export function saveDischargeSummary(id: string, input: DischargeInput): AdmissionView {
  requirePermission('discharge.approve', 'write discharge summaries')
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, id, 'Admission')
    if (!['REQUESTED', 'UNDER_REVIEW'].includes(a.discharge.status)) throw new ServiceError('Discharge has not been requested.', 'INVALID_STATE', 409)
    a.discharge = { ...a.discharge, ...input, status: 'UNDER_REVIEW' }
    a.history.push(audit(getActor().name, 'Discharge summary drafted'))
    return admissionView(db, a)
  })
}

export function approveDischarge(id: string, input: DischargeInput): AdmissionView {
  requirePermission('discharge.approve', 'approve discharges')
  const actor = getActor()
  if (actor.roleId !== 'DOCTOR' || !actor.doctorId) throw new ServiceError('Only a doctor can approve clinical discharge documentation.', 'FORBIDDEN', 403)
  for (const [k, v] of Object.entries({ 'final diagnosis': input.finalDiagnosis, 'treatment summary': input.treatmentSummary, 'medication instructions': input.medicationInstructions, 'follow-up advice': input.followUp })) {
    if (!v?.trim()) throw new ServiceError(`Enter the ${k}.`, 'VALIDATION', 422)
  }
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, id, 'Admission')
    if (!['REQUESTED', 'UNDER_REVIEW'].includes(a.discharge.status)) throw new ServiceError('Discharge has not been requested.', 'INVALID_STATE', 409)
    const now = new Date().toISOString()
    a.discharge = { ...a.discharge, ...input, status: 'APPROVED', approvedBy: actor.name, approvedAt: now }
    a.history.push(audit(actor.name, 'Discharge approved'))
    return admissionView(db, a)
  })
}

function postRoomCharges(db: ClinicDatabase, a: Admission, until: string) {
  const acc = a.accountId ? db.accounts.find((x) => x.id === a.accountId) : undefined
  if (!acc || !a.bedId) return
  const current = a.bedHistory.find((h) => !h.to)
  const { room } = bedLookup(db, a.bedId)
  if (!current || !room) return
  const nights = nightsBetween(current.from, until)
  acc.charges.push({ id: newId('chg'), date: until, category: 'ROOM', description: `Room ${room.number} — ${nights} night(s)`, quantity: nights, rate: room.dailyRate, taxRate: 0, amount: nights * room.dailyRate, tax: 0, addedBy: 'System', auto: true })
}

/** Final step: requires approved discharge and a settled (or finalised & cleared) account. Releases the bed. */
export function completeDischarge(id: string): AdmissionView {
  requirePermission('admissions.manage', 'complete discharges')
  return mutateClinic((db) => {
    const a = findOr404(db.admissions, id, 'Admission')
    if (a.discharge.status !== 'APPROVED') throw new ServiceError('A doctor must approve the discharge first.', 'INVALID_STATE', 409)
    const acc = a.accountId ? db.accounts.find((x) => x.id === a.accountId) : undefined
    if (acc && acc.status !== 'SETTLED') throw new ServiceError('Generate the final bill and settle the balance before completing discharge.', 'BILL_OUTSTANDING', 409)
    const now = new Date().toISOString()
    const current = a.bedHistory.find((h) => !h.to)
    if (current) current.to = now
    if (a.bedId) {
      const { bed } = findBed(db, a.bedId)
      if (bed.admissionId === a.id) {
        bed.status = 'AVAILABLE'
        bed.admissionId = undefined
      }
    }
    a.status = 'DISCHARGED'
    a.discharge = { ...a.discharge, status: 'COMPLETED', completedAt: now, completedBy: getActor().name }
    a.history.push(audit(getActor().name, 'Discharged', 'Bed released'))
    return admissionView(db, a)
  })
}

// ───────────────────────────── Patient billing ────────────────────────────

export function listAccounts(f: AccountFilters = {}): AccountView[] {
  requirePermission('billing.view', 'view patient bills')
  const db = getClinicDb()
  const q = f.search?.trim().toLowerCase()
  return db.accounts
    .map((a) => accountView(db, a))
    .filter((a) => !f.type || f.type === 'ALL' || (f.type === 'IPD' ? !!a.admissionId : !a.admissionId))
    .filter((a) => !f.status || f.status === 'ALL' || (f.status === 'DUE' ? a.totals.balance > 0.005 || !!a.accruedRoom : a.status === f.status))
    .filter((a) => !q || `${a.accountNo} ${a.patientName} ${a.patientCode} ${a.admissionNo ?? ''} ${a.billNo ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
}

export function getAccount(id: string): AccountView {
  requirePermission('billing.view', 'view patient bills')
  const db = getClinicDb()
  return accountView(db, findOr404(db.accounts, id, 'Patient account'))
}

const openAcc = (db: ClinicDatabase, id: string) => {
  const acc = findOr404(db.accounts, id, 'Patient account')
  if (acc.status !== 'OPEN') throw new ServiceError('This bill is finalised — charges can no longer be changed.', 'INVALID_STATE', 409)
  return acc
}

export function addCharge(accountId: string, input: ChargeInput): AccountView {
  requirePermission('billing.manage', 'add charges')
  if (!input.description.trim()) throw new ServiceError('Describe the charge.', 'VALIDATION', 422)
  if (input.quantity <= 0 || input.rate < 0 || input.taxRate < 0 || input.taxRate > 28) throw new ServiceError('Check quantity, rate and tax.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    const acc = openAcc(db, accountId)
    const amount = round2(input.quantity * input.rate)
    const c: PatientCharge = { ...input, id: newId('chg'), date: new Date().toISOString(), description: input.description.trim(), amount, tax: round2((amount * input.taxRate) / 100), addedBy: getActor().name }
    acc.charges.push(c)
    return accountView(db, acc)
  })
}

export function removeCharge(accountId: string, chargeId: string): AccountView {
  requirePermission('billing.manage', 'remove charges')
  return mutateClinic((db) => {
    const acc = openAcc(db, accountId)
    const c = findOr404(acc.charges, chargeId, 'Charge')
    if (c.auto || c.saleId) throw new ServiceError('System and pharmacy charges cannot be removed here.', 'INVALID_STATE', 409)
    acc.charges = acc.charges.filter((x) => x.id !== chargeId)
    return accountView(db, acc)
  })
}

export function setDiscount(accountId: string, amount: number): AccountView {
  requirePermission('billing.manage', 'apply discounts')
  return mutateClinic((db) => {
    const acc = openAcc(db, accountId)
    const t = accountTotals({ ...acc, discount: 0 })
    const maxPct = getActor().maxDiscountPct
    if (amount < 0 || amount > t.net) throw new ServiceError('Discount must be between zero and the bill amount.', 'VALIDATION', 422)
    if (t.net > 0 && (amount / t.net) * 100 > maxPct + 0.001) throw new ServiceError(`Your role can discount up to ${maxPct}% of the bill.`, 'DISCOUNT_LIMIT', 422)
    acc.discount = round2(amount)
    return accountView(db, acc)
  })
}

export function recordPayment(accountId: string, input: PaymentInput): AccountView {
  requirePermission('billing.manage', 'record payments')
  if (!(input.amount > 0)) throw new ServiceError('Enter an amount greater than zero.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    const acc = findOr404(db.accounts, accountId, 'Patient account')
    if (acc.status === 'SETTLED') throw new ServiceError('This bill is already settled.', 'INVALID_STATE', 409)
    const t = accountTotals(acc)
    if (input.kind === 'REFUND' && input.amount > -t.balance + 0.005) throw new ServiceError('Refund cannot exceed the amount paid in excess.', 'VALIDATION', 422)
    if (input.kind !== 'ADVANCE' && input.kind !== 'REFUND' && input.amount > t.balance + 0.005) throw new ServiceError(`Payment exceeds the balance of ₹${t.balance.toFixed(2)}. Record extra as an advance.`, 'VALIDATION', 422)
    acc.payments.push({ ...input, id: newId('pay'), receiptNo: clinicDocNo(db, 'receipt', 'RCPT'), date: new Date().toISOString(), amount: round2(input.amount), by: getActor().name })
    if (acc.status === 'FINALISED' && Math.abs(accountTotals(acc).balance) < 0.005) acc.status = 'SETTLED'
    return accountView(db, acc)
  })
}

/** Generates the final bill: posts room nights (inpatients) and locks charges. */
export function finaliseBill(accountId: string): AccountView {
  requirePermission('billing.manage', 'generate final bills')
  return mutateClinic((db) => {
    const acc = openAcc(db, accountId)
    const adm = acc.admissionId ? db.admissions.find((a) => a.id === acc.admissionId) : undefined
    if (adm) {
      if (adm.discharge.status !== 'APPROVED' && adm.discharge.status !== 'COMPLETED') throw new ServiceError('Final inpatient bills are generated after the doctor approves discharge.', 'INVALID_STATE', 409)
      if (adm.admittedAt && !acc.charges.some((c) => c.category === 'ROOM' && c.auto && !c.description.includes('before transfer'))) postRoomCharges(db, adm, new Date().toISOString())
    }
    acc.status = 'FINALISED'
    acc.finalisedAt = new Date().toISOString()
    acc.billNo = clinicDocNo(db, 'bill', adm ? 'IPB' : 'OPB')
    if (Math.abs(accountTotals(acc).balance) < 0.005) acc.status = 'SETTLED'
    return accountView(db, acc)
  })
}

/** Links a pharmacy sale (charged to the patient's account) as a medicine charge. */
export function linkPharmacySale(accountId: string, sale: { saleId: string; invoiceNumber: string; amount: number }): AccountView {
  return mutateClinic((db) => {
    const acc = openAcc(db, accountId)
    if (acc.charges.some((c) => c.saleId === sale.saleId)) return accountView(db, acc)
    acc.charges.push({ id: newId('chg'), date: new Date().toISOString(), category: 'MEDICINE', description: `Pharmacy invoice ${sale.invoiceNumber}`, quantity: 1, rate: sale.amount, taxRate: 0, amount: round2(sale.amount), tax: 0, saleId: sale.saleId, invoiceNumber: sale.invoiceNumber, addedBy: getActor().name, auto: true })
    return accountView(db, acc)
  })
}

export function openAccountsFor(patientId: string): AccountView[] {
  const db = getClinicDb()
  return db.accounts.filter((a) => a.patientId === patientId && a.status === 'OPEN').map((a) => accountView(db, a))
}

export function activeAdmissionAccounts(): { accountId: string; accountNo: string; patientName: string; patientCode: string; admissionNo: string; bed?: string }[] {
  const db = getClinicDb()
  return db.admissions
    .filter((a) => ACTIVE_ADMISSION.includes(a.status) && a.accountId)
    .map((a) => {
      const acc = db.accounts.find((x) => x.id === a.accountId)!
      const p = patientOf(db, a.patientId)
      return { accountId: acc.id, accountNo: acc.accountNo, patientName: p.name, patientCode: p.patientCode, admissionNo: a.admissionNo, bed: bedLookup(db, a.bedId).bed?.label }
    })
    .filter((x) => db.accounts.find((a) => a.id === x.accountId)?.status === 'OPEN')
}
