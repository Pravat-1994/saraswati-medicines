/** Request / response models for the healthcare services. */
import type {
  Admission,
  AdmissionStatus,
  AdmissionType,
  Appointment,
  AppointmentStatus,
  Bed,
  ClinicalEntry,
  ClinicalEntryKind,
  Consultation,
  ConsultationType,
  Doctor,
  DoctorReview,
  EmergencyContact,
  FileMeta,
  Gender,
  Patient,
  PatientAccount,
  PatientCharge,
  PatientPayment,
  Prescription,
  PrescriptionItem,
  Room,
  RoomType,
  Vitals,
} from './clinic'
import type { AccountTotals } from '../lib/clinic'

// ─── Doctors ───
export interface DoctorFilters {
  search?: string
  specialization?: string
  language?: string
  type?: ConsultationType
  maxFee?: number
  minExperience?: number
  availability?: 'ONLINE' | 'TODAY' | 'ALL'
}

export interface DoctorListItem extends Doctor {
  rating?: number
  reviewCount: number
  nextAvailable?: { date: string; start: string }
  todaySlotsFree: number
}

export interface DoctorDetail {
  doctor: DoctorListItem
  reviews: DoctorReview[]
  upcomingCount: number
  completedCount: number
}

export type DoctorInput = Omit<Doctor, 'id' | 'userId'>

export interface SlotView {
  start: string
  end: string
  available: boolean
  reason?: 'BOOKED' | 'PAST'
}

// ─── Appointments ───
export interface AppointmentFilters {
  view?: 'UPCOMING' | 'TODAY' | 'PAST' | 'ALL'
  status?: AppointmentStatus | 'ALL'
  doctorId?: string
  patientId?: string
  type?: ConsultationType | 'ALL'
  search?: string
  mine?: boolean
}

export interface AppointmentView extends Appointment {
  patientName: string
  patientCode: string
  doctorName: string
  specialization: string
}

export interface AppointmentDetail {
  appointment: AppointmentView
  patient: Patient
  doctor: Doctor
  consultation?: Consultation
  prescriptions: Prescription[]
}

export interface BookAppointmentRequest {
  patientId: string
  doctorId: string
  type: ConsultationType
  date: string
  start: string
  reason: string
  symptoms?: string
  reports?: Omit<FileMeta, 'uploadedAt' | 'uploadedBy'>[]
}

// ─── Patients ───
export interface PatientInput {
  name: string
  dateOfBirth: string
  gender: Gender
  phone: string
  email?: string
  address: string
  emergencyContact?: EmergencyContact
  bloodGroup?: string
  allergies: string[]
  conditions: string[]
  history?: string
}

export interface PatientListItem extends Patient {
  age: number
  lastVisit?: string
  activeAdmission?: { id: string; admissionNo: string; bed?: string }
  appointmentCount: number
}

export interface PatientProfile {
  patient: PatientListItem
  appointments: AppointmentView[]
  admissions: AdmissionView[]
  prescriptions: PrescriptionView[]
  accounts: AccountView[]
  latestVitals?: ClinicalEntry
}

/** Portal: register or match an existing patient by phone + date of birth. */
export interface PortalPatientRequest {
  name: string
  phone: string
  dateOfBirth: string
  gender: Gender
  email?: string
}

export interface PortalBooking {
  appointmentNo: string
  patientCode: string
  doctorName: string
  specialization: string
  type: ConsultationType
  date: string
  start: string
  end: string
  status: AppointmentStatus
  fee: number
  reason: string
  canCancel: boolean
}

// ─── Consultations ───
export interface ConsultationRoom {
  consultation: Consultation
  appointment: AppointmentView
  patient: Patient
  doctor: Doctor
  prescriptions: Prescription[]
  video: { provider: 'NONE' | 'JITSI' | 'CUSTOM'; url?: string }
}

// ─── Prescriptions ───
export interface PrescriptionFilters {
  status?: 'DRAFT' | 'FINAL' | 'ALL'
  fulfilment?: Prescription['fulfilment'] | 'ALL'
  doctorId?: string
  patientId?: string
  search?: string
  mine?: boolean
}

export interface PrescriptionView extends Prescription {
  patientName: string
  patientCode: string
  doctorName: string
  specialization: string
}

export interface PrescriptionItemAvailability {
  itemId: string
  medicineId?: string
  stocked: boolean
  available: number
  pending: number
  /** Can be added to the POS cart now. */
  dispensable: number
  prescriptionRequired: boolean
}

export interface PrescriptionDetail {
  prescription: PrescriptionView
  patient: Patient
  doctor: Doctor
  availability: PrescriptionItemAvailability[]
  activeAdmission?: { id: string; admissionNo: string; accountId?: string; accountNo?: string }
}

export interface PrescriptionInput {
  patientId: string
  consultationId?: string
  appointmentId?: string
  admissionId?: string
  diagnosis: string
  symptoms: string
  items: Omit<PrescriptionItem, 'id' | 'dispensedQty'>[]
  recommendations: string
  followUpDate?: string
}

export interface DispenseRecord {
  prescriptionId: string
  saleId: string
  invoiceNumber: string
  lines: { medicineId: string; quantity: number }[]
}

// ─── Rooms & beds ───
export interface BedView extends Bed {
  roomNumber: string
  roomType: RoomType
  department: string
  dailyRate: number
  patientName?: string
  patientCode?: string
  admissionNo?: string
  since?: string
}

export interface RoomView extends Omit<Room, 'beds'> {
  beds: BedView[]
  counts: Record<Bed['status'], number>
}

export interface BedSummary {
  total: number
  available: number
  occupied: number
  reserved: number
  maintenance: number
  byType: { type: RoomType; total: number; available: number }[]
}

// ─── Admissions ───
export interface AdmissionFilters {
  status?: AdmissionStatus | 'ACTIVE' | 'ALL'
  department?: string
  doctorId?: string
  roomType?: RoomType
  from?: string
  to?: string
  search?: string
  mine?: boolean
}

export interface AdmissionView extends Admission {
  patientName: string
  patientCode: string
  patientAge: number
  patientGender: Gender
  doctorName: string
  roomNumber?: string
  bedLabel?: string
  roomType?: RoomType
  lengthOfStayDays?: number
}

export interface AdmissionDetail {
  admission: AdmissionView
  patient: Patient
  doctor: Doctor
  bed?: BedView
  account?: AccountView
  clinical: ClinicalEntry[]
  prescriptions: PrescriptionView[]
}

export interface AdmissionRequestInput {
  patientId: string
  doctorId: string
  type: AdmissionType
  department: string
  reason: string
  diagnosis: string
  attendant?: EmergencyContact
  initialObservations: string
  expectedDischarge?: string
  preferredRoomType?: RoomType
}

export interface InpatientDashboard {
  admitted: number
  underTreatment: number
  pendingRequests: number
  awaitingDischarge: number
  beds: BedSummary
  occupancyPct: number
  recentAdmissions: AdmissionView[]
  expectedDischarges: AdmissionView[]
  byDepartment: { department: string; patients: number }[]
  admissionsTrend: { date: string; admissions: number; discharges: number }[]
}

// ─── Clinical records ───
export interface ClinicalEntryInput {
  patientId: string
  admissionId?: string
  kind: ClinicalEntryKind
  title?: string
  text?: string
  vitals?: Vitals
  medication?: { name: string; dose: string; route: string; givenAt: string }
  file?: Omit<FileMeta, 'uploadedAt' | 'uploadedBy'>
}

// ─── Discharge ───
export interface DischargeInput {
  finalDiagnosis: string
  treatmentSummary: string
  medicationInstructions: string
  followUp: string
  followUpDate?: string
}

// ─── Billing ───
export interface AccountView extends PatientAccount {
  patientName: string
  patientCode: string
  admissionNo?: string
  appointmentNo?: string
  totals: AccountTotals
  /** Room nights accrued but not yet posted (open inpatient accounts). */
  accruedRoom?: { nights: number; rate: number; amount: number; roomNumber: string }
}

export interface AccountFilters {
  status?: PatientAccount['status'] | 'ALL' | 'DUE'
  type?: 'IPD' | 'OPD' | 'ALL'
  search?: string
}

export type ChargeInput = Pick<PatientCharge, 'category' | 'description' | 'quantity' | 'rate' | 'taxRate'>
export type PaymentInput = Pick<PatientPayment, 'amount' | 'method' | 'kind' | 'reference'>

export type { Admission, Appointment, Consultation, Doctor, Patient, Prescription, Room, PatientAccount }
