/**
 * Healthcare domain: doctors, appointments, consultations, prescriptions,
 * patients, admissions, rooms/beds, clinical records, discharge and patient billing.
 *
 * PRIVACY: these records are sensitive. In demo mode they are held in memory
 * only (never written to browser storage). In production they must live in
 * Decisions with server-side authorisation and audit trails.
 */
import type { ISODate, ISODateTime, PaymentMethod } from './domain'

// ───────────────────────────────── Doctors ─────────────────────────────────

export type ConsultationType = 'VIDEO' | 'AUDIO' | 'IN_PERSON'

export interface WeeklySlot {
  /** 0 = Sunday … 6 = Saturday */
  day: number
  start: string // HH:MM
  end: string // HH:MM
}

export interface Doctor {
  id: string
  name: string
  /** Data URL or asset URL. Demo uses generated avatars. */
  photoUrl?: string
  gender: 'MALE' | 'FEMALE'
  specialization: string
  qualifications: string
  experienceYears: number
  registrationNo: string
  registrationCouncil: string
  consultationFee: number
  languages: string[]
  affiliation: string
  consultationTypes: ConsultationType[]
  slotMinutes: number
  schedule: WeeklySlot[]
  /** Doctor has switched on online availability. */
  online: boolean
  bio: string
  /** App user who signs in as this doctor. */
  userId?: string
  isActive: boolean
}

export interface DoctorReview {
  id: string
  doctorId: string
  patientInitials: string
  rating: number
  comment: string
  date: ISODate
  appointmentId?: string
}

// ─────────────────────────────── Patients ─────────────────────────────────

export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

export interface EmergencyContact {
  name: string
  relation: string
  phone: string
}

export interface Patient {
  id: string
  /** Human-readable id, e.g. SMP-00012 */
  patientCode: string
  name: string
  dateOfBirth: ISODate
  gender: Gender
  phone: string
  email?: string
  address: string
  emergencyContact?: EmergencyContact
  bloodGroup?: string
  allergies: string[]
  conditions: string[]
  history?: string
  registeredAt: ISODateTime
  registeredBy: string
}

// ───────────────────────────── Appointments ───────────────────────────────

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export interface FileMeta {
  name: string
  size: number
  type: string
  uploadedAt: ISODateTime
  uploadedBy: string
}

export interface AuditEvent {
  at: ISODateTime
  by: string
  action: string
  note?: string
}

export interface Appointment {
  id: string
  appointmentNo: string
  patientId: string
  doctorId: string
  type: ConsultationType
  date: ISODate
  start: string
  end: string
  status: AppointmentStatus
  reason: string
  symptoms?: string
  reports: FileMeta[]
  fee: number
  bookedVia: 'PORTAL' | 'STAFF'
  createdAt: ISODateTime
  consultationId?: string
  cancelReason?: string
  history: AuditEvent[]
}

// ───────────────────────────── Consultations ──────────────────────────────

export interface ChatMessage {
  id: string
  from: 'DOCTOR' | 'PATIENT' | 'SYSTEM'
  author: string
  text: string
  at: ISODateTime
  file?: FileMeta
}

export interface Consultation {
  id: string
  appointmentId: string
  patientId: string
  doctorId: string
  type: ConsultationType
  status: 'IN_PROGRESS' | 'COMPLETED'
  startedAt: ISODateTime
  endedAt?: ISODateTime
  messages: ChatMessage[]
  files: FileMeta[]
  notes: string
  /** Provider room / meeting id when a video provider is configured. */
  meetingRoom?: string
}

// ───────────────────────────── Prescriptions ──────────────────────────────

export type PrescriptionStatus = 'DRAFT' | 'FINAL'
export type FulfilmentStatus = 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'UNAVAILABLE'

export interface PrescriptionItem {
  id: string
  /** Catalogue medicine when the prescribed item is stocked. */
  medicineId?: string
  medicineName: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
  /** Units (packs) to dispense. */
  quantity: number
  dispensedQty: number
}

export interface Prescription {
  id: string
  rxNo: string
  patientId: string
  doctorId: string
  consultationId?: string
  appointmentId?: string
  admissionId?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
  diagnosis: string
  symptoms: string
  items: PrescriptionItem[]
  recommendations: string
  followUpDate?: ISODate
  status: PrescriptionStatus
  /** Typed name + registration no. recorded at finalisation by the authorised doctor. */
  signature?: { name: string; registrationNo: string; signedAt: ISODateTime; userId: string }
  fulfilment: FulfilmentStatus
  saleIds: string[]
  history: AuditEvent[]
}

// ───────────────────────────── Rooms & beds ───────────────────────────────

export type RoomType = 'GENERAL_WARD' | 'SEMI_PRIVATE' | 'PRIVATE' | 'EMERGENCY' | 'OBSERVATION'
export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'

export interface Bed {
  id: string
  roomId: string
  label: string
  status: BedStatus
  admissionId?: string
  note?: string
}

export interface Room {
  id: string
  number: string
  type: RoomType
  department: string
  floor: string
  /** Per-bed daily charge (₹). */
  dailyRate: number
  beds: Bed[]
}

// ───────────────────────────── Admissions ─────────────────────────────────

export type AdmissionType = 'EMERGENCY' | 'PLANNED' | 'REFERRAL' | 'OBSERVATION'
export type AdmissionStatus = 'REQUESTED' | 'APPROVED' | 'ADMITTED' | 'UNDER_TREATMENT' | 'DISCHARGE_REQUESTED' | 'DISCHARGED' | 'CANCELLED'
export type DischargeStatus = 'NOT_REQUESTED' | 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'COMPLETED'

export interface BedAssignment {
  bedId: string
  roomId: string
  from: ISODateTime
  to?: ISODateTime
  reason: string
  by: string
}

export interface DischargeSummary {
  status: DischargeStatus
  requestedAt?: ISODateTime
  requestedBy?: string
  finalDiagnosis?: string
  treatmentSummary?: string
  medicationInstructions?: string
  followUp?: string
  followUpDate?: ISODate
  approvedBy?: string
  approvedAt?: ISODateTime
  completedAt?: ISODateTime
  completedBy?: string
}

export interface Admission {
  id: string
  admissionNo: string
  patientId: string
  doctorId: string
  requestedAt: ISODateTime
  requestedBy: string
  admittedAt?: ISODateTime
  expectedDischarge?: ISODate
  reason: string
  diagnosis: string
  type: AdmissionType
  department: string
  /** Room type requested at admission (used to suggest beds). */
  preferredRoomType?: RoomType
  roomId?: string
  bedId?: string
  attendant?: EmergencyContact
  initialObservations: string
  status: AdmissionStatus
  bedHistory: BedAssignment[]
  discharge: DischargeSummary
  accountId?: string
  cancelReason?: string
  history: AuditEvent[]
}

// ───────────────────────────── Clinical records ───────────────────────────

export type ClinicalEntryKind = 'ASSESSMENT' | 'DOCTOR_NOTE' | 'TREATMENT_PLAN' | 'PROGRESS' | 'VITALS' | 'MEDICATION' | 'DOCUMENT' | 'FOLLOW_UP'

export interface Vitals {
  systolic?: number
  diastolic?: number
  heartRate?: number
  temperatureC?: number
  respiratoryRate?: number
  spo2?: number
  weightKg?: number
}

export interface ClinicalEntry {
  id: string
  patientId: string
  admissionId?: string
  kind: ClinicalEntryKind
  at: ISODateTime
  by: string
  byRole: string
  title?: string
  text?: string
  vitals?: Vitals
  medication?: { name: string; dose: string; route: string; givenAt: ISODateTime }
  file?: FileMeta
}

// ───────────────────────────── Patient billing ────────────────────────────

export type ChargeCategory = 'ADMISSION' | 'ROOM' | 'BED' | 'CONSULTATION' | 'TREATMENT' | 'MEDICINE' | 'SERVICE'

export interface PatientCharge {
  id: string
  date: ISODateTime
  category: ChargeCategory
  description: string
  quantity: number
  rate: number
  taxRate: number
  amount: number
  tax: number
  /** Linked pharmacy sale (medicine charges). */
  saleId?: string
  invoiceNumber?: string
  addedBy: string
  /** System-generated (e.g. room nights at final billing). */
  auto?: boolean
}

export interface PatientPayment {
  id: string
  receiptNo: string
  date: ISODateTime
  amount: number
  method: PaymentMethod | 'BANK_TRANSFER' | 'INSURANCE'
  kind: 'ADVANCE' | 'PARTIAL' | 'FINAL' | 'REFUND'
  reference?: string
  by: string
}

export interface PatientAccount {
  id: string
  accountNo: string
  patientId: string
  admissionId?: string
  appointmentId?: string
  openedAt: ISODateTime
  charges: PatientCharge[]
  discount: number
  payments: PatientPayment[]
  status: 'OPEN' | 'FINALISED' | 'SETTLED'
  finalisedAt?: ISODateTime
  billNo?: string
}

// ──────────────────────────────── Settings ────────────────────────────────

export interface ClinicSettings {
  facilityName: string
  departments: string[]
  specializations: string[]
  admissionCharge: number
  /** Video provider for online consultations. NONE = demo UI only. */
  videoProvider: 'NONE' | 'JITSI' | 'CUSTOM'
  videoBaseUrl: string
  defaultSlotMinutes: number
  bookingWindowDays: number
  maxReportSizeMb: number
  serviceCatalog: { code: string; name: string; rate: number; taxRate: number; category: ChargeCategory }[]
}
