import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/schedulingHandlers'
import type { AppointmentDetail, AppointmentFilters, AppointmentView, BookAppointmentRequest, DoctorListItem, PortalBooking, PortalPatientRequest, SlotView } from '../types/clinicApi'

/** Staff-side appointment scheduling. */
export const appointmentService = {
  list(filters: AppointmentFilters = {}): Promise<AppointmentView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.appointments.list, filters, () => mock.listAppointments(filters))
  },
  get(id: string): Promise<AppointmentDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.appointments.get, { id }, () => mock.getAppointment(id))
  },
  /** Staff books on behalf of a patient (status Confirmed). Server must re-check slot availability. */
  book(req: BookAppointmentRequest): Promise<AppointmentView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (appointment booking flow).
    return invoke(F.appointments.book, req, () => mock.bookAppointment(req))
  },
  reschedule(id: string, date: string, start: string): Promise<AppointmentView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.appointments.reschedule, { id, date, start }, () => mock.rescheduleAsStaff(id, date, start))
  },
  cancel(id: string, reason: string): Promise<AppointmentView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.appointments.cancel, { id, reason }, () => mock.cancelAppointment(id, reason))
  },
  setStatus(id: string, status: 'CONFIRMED' | 'SCHEDULED' | 'NO_SHOW'): Promise<AppointmentView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.appointments.status, { id, status }, () => mock.setAppointmentStatus(id, status))
  },
}

/** Patient-facing booking portal (public / patient-authenticated flows). */
export const patientPortalService = {
  doctors(): Promise<DoctorListItem[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.portal.doctors, {}, () => mock.portalPublicDoctors())
  },
  slots(doctorId: string, date: string): Promise<SlotView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.portal.slots, { doctorId, date }, () => mock.doctorSlotsFor(doctorId, date))
  },
  /** Registers (or matches) the patient by mobile + date of birth, then books (status Pending). */
  book(patient: PortalPatientRequest, req: Omit<BookAppointmentRequest, 'patientId'>): Promise<PortalBooking> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (patient registration + booking flows).
    return invoke(F.portal.book, { patient, ...req }, () => mock.portalBook(patient, req))
  },
  myAppointments(phone: string, dateOfBirth: string): Promise<PortalBooking[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (use OTP verification in production).
    return invoke(F.portal.myAppointments, { phone, dateOfBirth }, () => mock.portalAppointments(phone, dateOfBirth))
  },
  cancel(appointmentNo: string, phone: string, dateOfBirth: string): Promise<PortalBooking> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.portal.cancel, { appointmentNo, phone, dateOfBirth }, () => mock.portalCancel(appointmentNo, phone, dateOfBirth))
  },
}
