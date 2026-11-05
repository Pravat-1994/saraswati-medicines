/** Doctors, availability, appointments, patient-portal booking and consultations. */
import { ACTIVE_ADMISSION, doctorSlots, overlaps, toMinutes } from '../../lib/clinic'
import { addDays, toISODate, todayISO } from '../../lib/dates'
import { newId } from '../../lib/utils'
import { actorCan, getActor, requirePermission } from '../../services/core/actor'
import { ServiceError } from '../../types/api'
import type { Appointment, AppointmentStatus, ChatMessage, Consultation, Doctor, FileMeta, Patient } from '../../types/clinic'
import type {
  AppointmentDetail,
  AppointmentFilters,
  AppointmentView,
  BookAppointmentRequest,
  ConsultationRoom,
  DoctorDetail,
  DoctorFilters,
  DoctorInput,
  DoctorListItem,
  PortalBooking,
  PortalPatientRequest,
  SlotView,
} from '../../types/clinicApi'
import { clinicDocNo, getClinicDb, mutateClinic } from '../clinicDb'
import type { ClinicDatabase } from '../clinicSeed'
import { appointmentView, audit, doctorOf, findOr404, patientOf, phoneKey, prescriptionView } from './views'

const BLOCKING: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']
const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ───────────────────────────────── Doctors ─────────────────────────────────

export function slotsFor(db: ClinicDatabase, doctorId: string, date: string, ignoreAppointmentId?: string): SlotView[] {
  const doctor = doctorOf(db, doctorId)
  const taken = db.appointments.filter((a) => a.doctorId === doctorId && a.date === date && BLOCKING.includes(a.status) && a.id !== ignoreAppointmentId)
  const isToday = date === todayISO()
  const cutoff = nowHHMM()
  return doctorSlots(doctor, date).map((s) => {
    if (date < todayISO() || (isToday && s.start <= cutoff)) return { ...s, available: false, reason: 'PAST' as const }
    if (taken.some((a) => overlaps(a.start, a.end, s.start, s.end))) return { ...s, available: false, reason: 'BOOKED' as const }
    return { ...s, available: true }
  })
}

function toListItem(db: ClinicDatabase, d: Doctor): DoctorListItem {
  const reviews = db.reviews.filter((r) => r.doctorId === d.id)
  const today = todayISO()
  let next: DoctorListItem['nextAvailable']
  for (let i = 0; i < db.settings.bookingWindowDays && !next; i++) {
    const date = toISODate(addDays(new Date(), i))
    const s = slotsFor(db, d.id, date).find((x) => x.available)
    if (s) next = { date, start: s.start }
  }
  return {
    ...d,
    rating: reviews.length ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10 : undefined,
    reviewCount: reviews.length,
    nextAvailable: next,
    todaySlotsFree: slotsFor(db, d.id, today).filter((s) => s.available).length,
  }
}

export function listDoctors(f: DoctorFilters = {}): DoctorListItem[] {
  const db = getClinicDb()
  const q = f.search?.trim().toLowerCase()
  return db.doctors
    .filter((d) => d.isActive)
    .filter((d) => !q || `${d.name} ${d.specialization} ${d.qualifications} ${d.affiliation}`.toLowerCase().includes(q))
    .filter((d) => !f.specialization || d.specialization === f.specialization)
    .filter((d) => !f.language || d.languages.includes(f.language))
    .filter((d) => !f.type || d.consultationTypes.includes(f.type))
    .filter((d) => !f.maxFee || d.consultationFee <= f.maxFee)
    .filter((d) => !f.minExperience || d.experienceYears >= f.minExperience)
    .map((d) => toListItem(db, d))
    .filter((d) => !f.availability || f.availability === 'ALL' || (f.availability === 'ONLINE' ? d.online : d.todaySlotsFree > 0))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
}

export function getDoctor(id: string): DoctorDetail {
  const db = getClinicDb()
  const d = doctorOf(db, id)
  const appts = db.appointments.filter((a) => a.doctorId === id)
  return {
    doctor: toListItem(db, d),
    reviews: db.reviews.filter((r) => r.doctorId === id).sort((a, b) => b.date.localeCompare(a.date)),
    upcomingCount: appts.filter((a) => a.date >= todayISO() && ['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(a.status)).length,
    completedCount: appts.filter((a) => a.status === 'COMPLETED').length,
  }
}

export function doctorSlotsFor(doctorId: string, date: string): SlotView[] {
  return slotsFor(getClinicDb(), doctorId, date)
}

function validateDoctor(input: DoctorInput) {
  if (input.consultationFee < 0) throw new ServiceError('Fee cannot be negative.', 'VALIDATION', 422)
  if (input.consultationTypes.length === 0) throw new ServiceError('Select at least one consultation type.', 'VALIDATION', 422)
  if (input.slotMinutes < 5 || input.slotMinutes > 120) throw new ServiceError('Slot duration must be 5–120 minutes.', 'VALIDATION', 422)
  for (const s of input.schedule) if (toMinutes(s.end) <= toMinutes(s.start)) throw new ServiceError('Each availability block must end after it starts.', 'VALIDATION', 422)
}

export function saveDoctor(input: DoctorInput, id?: string): Doctor {
  requirePermission('doctors.manage', 'manage doctor profiles')
  validateDoctor(input)
  return mutateClinic((db) => {
    if (db.doctors.some((d) => d.registrationNo.toUpperCase() === input.registrationNo.toUpperCase() && d.id !== id)) {
      throw new ServiceError('Another doctor already uses this registration number.', 'DUPLICATE', 409)
    }
    if (id) {
      const d = doctorOf(db, id)
      Object.assign(d, input)
      return d
    }
    const d: Doctor = { ...input, id: newId('doc') }
    db.doctors.push(d)
    return d
  })
}

/** Doctor toggles their own online availability (or a manager does it for them). */
export function setDoctorOnline(id: string, online: boolean): Doctor {
  const actor = getActor()
  if (actor.doctorId !== id && !actorCan('doctors.manage')) throw new ServiceError('You can only change your own availability.', 'FORBIDDEN', 403)
  return mutateClinic((db) => {
    const d = doctorOf(db, id)
    d.online = online
    return d
  })
}

// ───────────────────────────── Appointments ───────────────────────────────

export function listAppointments(f: AppointmentFilters = {}): AppointmentView[] {
  requirePermission('appointments.view', 'view appointments')
  const db = getClinicDb()
  const today = todayISO()
  const actor = getActor()
  const q = f.search?.trim().toLowerCase()
  return db.appointments
    .filter((a) => !f.mine || a.doctorId === actor.doctorId)
    .filter((a) => {
      if (!f.view || f.view === 'ALL') return true
      if (f.view === 'TODAY') return a.date === today
      if (f.view === 'UPCOMING') return a.date >= today && ['PENDING', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'].includes(a.status)
      return a.date < today || ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status)
    })
    .filter((a) => !f.status || f.status === 'ALL' || a.status === f.status)
    .filter((a) => !f.doctorId || a.doctorId === f.doctorId)
    .filter((a) => !f.patientId || a.patientId === f.patientId)
    .filter((a) => !f.type || f.type === 'ALL' || a.type === f.type)
    .map((a) => appointmentView(db, a))
    .filter((a) => !q || `${a.appointmentNo} ${a.patientName} ${a.patientCode} ${a.doctorName} ${a.reason}`.toLowerCase().includes(q))
    .sort((x, y) => (f.view === 'PAST' || f.view === 'ALL' ? `${y.date}${y.start}`.localeCompare(`${x.date}${x.start}`) : `${x.date}${x.start}`.localeCompare(`${y.date}${y.start}`)))
}

export function getAppointment(id: string): AppointmentDetail {
  requirePermission('appointments.view', 'view appointments')
  const db = getClinicDb()
  const a = findOr404(db.appointments, id, 'Appointment')
  return {
    appointment: appointmentView(db, a),
    patient: patientOf(db, a.patientId),
    doctor: doctorOf(db, a.doctorId),
    consultation: a.consultationId ? db.consultations.find((c) => c.id === a.consultationId) : undefined,
    prescriptions: db.prescriptions.filter((r) => r.appointmentId === a.id),
  }
}

function assertBookable(db: ClinicDatabase, doctor: Doctor, req: Pick<BookAppointmentRequest, 'type' | 'date' | 'start'>, ignoreId?: string) {
  if (!doctor.isActive) throw new ServiceError('This doctor is not taking appointments.', 'UNAVAILABLE', 409)
  if (!doctor.consultationTypes.includes(req.type)) throw new ServiceError(`${doctor.name} does not offer this consultation type.`, 'VALIDATION', 422)
  const maxDate = toISODate(addDays(new Date(), db.settings.bookingWindowDays))
  if (req.date > maxDate) throw new ServiceError(`Appointments can be booked up to ${db.settings.bookingWindowDays} days ahead.`, 'VALIDATION', 422)
  const slot = slotsFor(db, doctor.id, req.date, ignoreId).find((s) => s.start === req.start)
  if (!slot) throw new ServiceError('The doctor is not available at that time.', 'VALIDATION', 422)
  if (!slot.available) throw new ServiceError(slot.reason === 'PAST' ? 'That time has already passed.' : 'That slot was just booked — please choose another.', 'SLOT_TAKEN', 409)
  return slot
}

function checkFiles(db: ClinicDatabase, files: BookAppointmentRequest['reports'] = []) {
  const max = db.settings.maxReportSizeMb * 1024 * 1024
  for (const f of files) {
    if (f.size > max) throw new ServiceError(`${f.name} is larger than ${db.settings.maxReportSizeMb} MB.`, 'VALIDATION', 422)
    if (!/^(application\/pdf|image\/(png|jpe?g|webp))$/.test(f.type)) throw new ServiceError(`${f.name}: only PDF or image files are accepted.`, 'VALIDATION', 422)
  }
}

function createAppointment(db: ClinicDatabase, req: BookAppointmentRequest, via: Appointment['bookedVia'], by: string): Appointment {
  const doctor = doctorOf(db, req.doctorId)
  const patient = patientOf(db, req.patientId)
  const slot = assertBookable(db, doctor, req)
  checkFiles(db, req.reports)
  if (db.appointments.some((a) => a.patientId === patient.id && a.date === req.date && BLOCKING.includes(a.status) && a.status !== 'COMPLETED' && overlaps(a.start, a.end, slot.start, slot.end))) {
    throw new ServiceError('This patient already has an appointment at that time.', 'CONFLICT', 409)
  }
  const now = new Date().toISOString()
  const appt: Appointment = {
    id: newId('apt'),
    appointmentNo: clinicDocNo(db, 'appointment', 'APT'),
    patientId: patient.id,
    doctorId: doctor.id,
    type: req.type,
    date: req.date,
    start: slot.start,
    end: slot.end,
    status: via === 'PORTAL' ? 'PENDING' : 'CONFIRMED',
    reason: req.reason.trim(),
    symptoms: req.symptoms?.trim() || undefined,
    reports: (req.reports ?? []).map((f) => ({ ...f, uploadedAt: now, uploadedBy: by })),
    fee: doctor.consultationFee,
    bookedVia: via,
    createdAt: now,
    history: [audit(by, 'Booked', via === 'PORTAL' ? 'Online booking' : 'Booked by staff')],
  }
  db.appointments.unshift(appt)
  return appt
}

export function bookAppointment(req: BookAppointmentRequest): AppointmentView {
  requirePermission('appointments.manage', 'book appointments')
  if (!req.reason?.trim()) throw new ServiceError('Enter the reason for consultation.', 'VALIDATION', 422)
  return mutateClinic((db) => appointmentView(db, createAppointment(db, req, 'STAFF', getActor().name)))
}

export function rescheduleAppointment(id: string, date: string, start: string, by?: string): AppointmentView {
  return mutateClinic((db) => {
    const a = findOr404(db.appointments, id, 'Appointment')
    if (!['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(a.status)) throw new ServiceError('Only upcoming appointments can be rescheduled.', 'INVALID_STATE', 409)
    const slot = assertBookable(db, doctorOf(db, a.doctorId), { type: a.type, date, start }, a.id)
    const prev = `${a.date} ${a.start}`
    a.date = date
    a.start = slot.start
    a.end = slot.end
    a.history.push(audit(by ?? getActor().name, 'Rescheduled', `From ${prev}`))
    return appointmentView(db, a)
  })
}

export function rescheduleAsStaff(id: string, date: string, start: string): AppointmentView {
  requirePermission('appointments.manage', 'reschedule appointments')
  return rescheduleAppointment(id, date, start)
}

export function cancelAppointment(id: string, reason: string): AppointmentView {
  requirePermission('appointments.manage', 'cancel appointments')
  if (!reason.trim()) throw new ServiceError('Give a reason for cancelling.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    const a = findOr404(db.appointments, id, 'Appointment')
    if (!['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(a.status)) throw new ServiceError('This appointment can no longer be cancelled.', 'INVALID_STATE', 409)
    a.status = 'CANCELLED'
    a.cancelReason = reason.trim()
    a.history.push(audit(getActor().name, 'Cancelled', reason.trim()))
    return appointmentView(db, a)
  })
}

/** Workflow transitions available to staff: confirm a pending booking, schedule, or mark no-show. */
export function setAppointmentStatus(id: string, status: 'CONFIRMED' | 'SCHEDULED' | 'NO_SHOW'): AppointmentView {
  requirePermission('appointments.manage', 'update appointments')
  return mutateClinic((db) => {
    const a = findOr404(db.appointments, id, 'Appointment')
    const allowed: Record<typeof status, AppointmentStatus[]> = { CONFIRMED: ['PENDING'], SCHEDULED: ['PENDING', 'CONFIRMED'], NO_SHOW: ['CONFIRMED', 'SCHEDULED'] }
    if (!allowed[status].includes(a.status)) throw new ServiceError(`Cannot change from ${a.status.toLowerCase()} to ${status.toLowerCase()}.`, 'INVALID_STATE', 409)
    if (status === 'NO_SHOW' && `${a.date}T${a.start}` > `${todayISO()}T${nowHHMM()}`) throw new ServiceError('No-show can only be recorded after the appointment time.', 'INVALID_STATE', 409)
    a.status = status
    a.history.push(audit(getActor().name, status === 'NO_SHOW' ? 'Marked no-show' : status === 'SCHEDULED' ? 'Scheduled' : 'Confirmed'))
    return appointmentView(db, a)
  })
}

// ───────────────────────────── Patient portal ─────────────────────────────

function portalPatient(db: ClinicDatabase, req: PortalPatientRequest): Patient {
  if (req.name.trim().length < 2) throw new ServiceError('Enter your full name.', 'VALIDATION', 422)
  if (phoneKey(req.phone).length !== 10) throw new ServiceError('Enter a valid 10-digit mobile number.', 'VALIDATION', 422)
  if (!req.dateOfBirth || req.dateOfBirth > todayISO()) throw new ServiceError('Enter a valid date of birth.', 'VALIDATION', 422)
  const existing = db.patients.find((p) => phoneKey(p.phone) === phoneKey(req.phone) && p.dateOfBirth === req.dateOfBirth)
  if (existing) return existing
  const p: Patient = {
    id: newId('pat'),
    patientCode: clinicDocNo(db, 'patient', 'SMP').replace(/\/\d{2}-\d{2}\//, '-'),
    name: req.name.trim(),
    dateOfBirth: req.dateOfBirth,
    gender: req.gender,
    phone: req.phone.trim(),
    email: req.email?.trim() || undefined,
    address: '',
    allergies: [],
    conditions: [],
    registeredAt: new Date().toISOString(),
    registeredBy: 'Online portal',
  }
  db.patients.push(p)
  return p
}

function toPortal(db: ClinicDatabase, a: Appointment): PortalBooking {
  const d = doctorOf(db, a.doctorId)
  const p = patientOf(db, a.patientId)
  return { appointmentNo: a.appointmentNo, patientCode: p.patientCode, doctorName: d.name, specialization: d.specialization, type: a.type, date: a.date, start: a.start, end: a.end, status: a.status, fee: a.fee, reason: a.reason, canCancel: ['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(a.status) }
}

export function portalBook(patient: PortalPatientRequest, req: Omit<BookAppointmentRequest, 'patientId'>): PortalBooking {
  if (!req.reason?.trim()) throw new ServiceError('Tell us the reason for your consultation.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    const p = portalPatient(db, patient)
    return toPortal(db, createAppointment(db, { ...req, patientId: p.id }, 'PORTAL', p.name))
  })
}

/** Portal lookup: requires the registered mobile number; returns only the caller's bookings. */
export function portalAppointments(phone: string, dateOfBirth: string): PortalBooking[] {
  const db = getClinicDb()
  const ids = db.patients.filter((p) => phoneKey(p.phone) === phoneKey(phone) && p.dateOfBirth === dateOfBirth).map((p) => p.id)
  if (ids.length === 0) throw new ServiceError('No patient found with that mobile number and date of birth.', 'NOT_FOUND', 404)
  return db.appointments
    .filter((a) => ids.includes(a.patientId))
    .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
    .map((a) => toPortal(db, a))
}

export function portalCancel(appointmentNo: string, phone: string, dateOfBirth: string): PortalBooking {
  return mutateClinic((db) => {
    const a = db.appointments.find((x) => x.appointmentNo === appointmentNo)
    const p = a ? db.patients.find((x) => x.id === a.patientId) : undefined
    if (!a || !p || phoneKey(p.phone) !== phoneKey(phone) || p.dateOfBirth !== dateOfBirth) throw new ServiceError('Appointment not found.', 'NOT_FOUND', 404)
    if (!['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(a.status)) throw new ServiceError('This appointment can no longer be cancelled.', 'INVALID_STATE', 409)
    a.status = 'CANCELLED'
    a.cancelReason = 'Cancelled by patient online'
    a.history.push(audit(p.name, 'Cancelled', 'Cancelled online by patient'))
    return toPortal(db, a)
  })
}

export function portalPublicDoctors(): DoctorListItem[] {
  return listDoctors({})
}

// ───────────────────────────── Consultations ──────────────────────────────

function requireOwnDoctor(db: ClinicDatabase, doctorId: string) {
  requirePermission('consultations.conduct', 'conduct consultations')
  const actor = getActor()
  if (actor.doctorId !== doctorId) throw new ServiceError(`Only ${doctorOf(db, doctorId).name} can conduct this consultation.`, 'FORBIDDEN', 403)
}

function roomFor(db: ClinicDatabase, c: Consultation): ConsultationRoom {
  const a = findOr404(db.appointments, c.appointmentId, 'Appointment')
  const provider = db.settings.videoProvider
  const url = provider !== 'NONE' && c.type !== 'IN_PERSON' && c.meetingRoom ? `${db.settings.videoBaseUrl.replace(/\/$/, '')}/${c.meetingRoom}` : undefined
  return {
    consultation: c,
    appointment: appointmentView(db, a),
    patient: patientOf(db, c.patientId),
    doctor: doctorOf(db, c.doctorId),
    prescriptions: db.prescriptions.filter((r) => r.consultationId === c.id).map((r) => prescriptionView(db, r)),
    video: { provider, url },
  }
}

export function startConsultation(appointmentId: string): ConsultationRoom {
  return mutateClinic((db) => {
    const a = findOr404(db.appointments, appointmentId, 'Appointment')
    requireOwnDoctor(db, a.doctorId)
    if (a.consultationId) {
      const existing = findOr404(db.consultations, a.consultationId, 'Consultation')
      return roomFor(db, existing)
    }
    if (!['CONFIRMED', 'SCHEDULED'].includes(a.status)) throw new ServiceError('Only confirmed or scheduled appointments can be started.', 'INVALID_STATE', 409)
    if (a.date !== todayISO()) throw new ServiceError('Consultations can only be started on the appointment day.', 'INVALID_STATE', 409)
    const now = new Date().toISOString()
    const c: Consultation = {
      id: newId('con'),
      appointmentId: a.id,
      patientId: a.patientId,
      doctorId: a.doctorId,
      type: a.type,
      status: 'IN_PROGRESS',
      startedAt: now,
      messages: [{ id: newId('msg'), from: 'SYSTEM', author: 'System', text: 'Consultation started', at: now }],
      files: [...a.reports],
      notes: '',
      meetingRoom: a.type !== 'IN_PERSON' ? `saraswati-${a.appointmentNo.replace(/\W/g, '').toLowerCase()}-${Math.random().toString(36).slice(2, 8)}` : undefined,
    }
    db.consultations.push(c)
    a.consultationId = c.id
    a.status = 'IN_PROGRESS'
    a.history.push(audit(getActor().name, 'Consultation started'))
    return roomFor(db, c)
  })
}

export function getConsultationRoom(consultationId: string): ConsultationRoom {
  requirePermission('appointments.view', 'view consultations')
  const db = getClinicDb()
  return roomFor(db, findOr404(db.consultations, consultationId, 'Consultation'))
}

export function postMessage(consultationId: string, text: string, file?: Omit<FileMeta, 'uploadedAt' | 'uploadedBy'>): ChatMessage {
  if (!text.trim() && !file) throw new ServiceError('Type a message or attach a file.', 'VALIDATION', 422)
  return mutateClinic((db) => {
    const c = findOr404(db.consultations, consultationId, 'Consultation')
    requireOwnDoctor(db, c.doctorId)
    if (c.status !== 'IN_PROGRESS') throw new ServiceError('This consultation has ended.', 'INVALID_STATE', 409)
    if (file) checkFiles(db, [file])
    const now = new Date().toISOString()
    const meta = file ? { ...file, uploadedAt: now, uploadedBy: getActor().name } : undefined
    const m: ChatMessage = { id: newId('msg'), from: 'DOCTOR', author: getActor().name, text: text.trim(), at: now, file: meta }
    c.messages.push(m)
    if (meta) c.files.push(meta)
    return m
  })
}

export function saveConsultationNotes(consultationId: string, notes: string): Consultation {
  return mutateClinic((db) => {
    const c = findOr404(db.consultations, consultationId, 'Consultation')
    requireOwnDoctor(db, c.doctorId)
    c.notes = notes
    return c
  })
}

export function endConsultation(consultationId: string, notes?: string): ConsultationRoom {
  return mutateClinic((db) => {
    const c = findOr404(db.consultations, consultationId, 'Consultation')
    requireOwnDoctor(db, c.doctorId)
    if (c.status !== 'IN_PROGRESS') throw new ServiceError('This consultation has already ended.', 'INVALID_STATE', 409)
    const now = new Date().toISOString()
    c.status = 'COMPLETED'
    c.endedAt = now
    if (notes !== undefined) c.notes = notes
    c.messages.push({ id: newId('msg'), from: 'SYSTEM', author: 'System', text: 'Consultation ended', at: now })
    const a = findOr404(db.appointments, c.appointmentId, 'Appointment')
    a.status = 'COMPLETED'
    a.history.push(audit(getActor().name, 'Completed'))
    // Consultation fee posted to an OPD patient account (settled at the front desk).
    db.accounts.push({
      id: newId('acc'),
      accountNo: clinicDocNo(db, 'account', 'PA'),
      patientId: a.patientId,
      appointmentId: a.id,
      openedAt: now,
      charges: [{ id: newId('chg'), date: now, category: 'CONSULTATION', description: `Consultation — ${doctorOf(db, a.doctorId).name}`, quantity: 1, rate: a.fee, taxRate: 0, amount: a.fee, tax: 0, addedBy: 'System', auto: true }],
      discount: 0,
      payments: [],
      status: 'OPEN',
    })
    return roomFor(db, c)
  })
}

export function clinicSnapshot() {
  const db = getClinicDb()
  const today = todayISO()
  return {
    appointmentsToday: db.appointments.filter((a) => a.date === today && a.status !== 'CANCELLED').length,
    pendingAppointments: db.appointments.filter((a) => a.status === 'PENDING').length,
    inpatients: db.admissions.filter((a) => ACTIVE_ADMISSION.includes(a.status)).length,
    pendingAdmissions: db.admissions.filter((a) => a.status === 'REQUESTED').length,
    pendingDischarges: db.admissions.filter((a) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(a.discharge.status)).length,
    rxToFulfil: db.prescriptions.filter((r) => r.status === 'FINAL' && (r.fulfilment === 'PENDING' || r.fulfilment === 'PARTIALLY_FULFILLED')).length,
    patientCount: db.patients.length,
  }
}
