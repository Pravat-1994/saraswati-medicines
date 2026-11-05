import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/schedulingHandlers'
import type { Doctor } from '../types/clinic'
import type { DoctorDetail, DoctorFilters, DoctorInput, DoctorListItem, SlotView } from '../types/clinicApi'

/** Doctor directory, profiles and availability. */
export const doctorService = {
  list(filters: DoctorFilters = {}): Promise<DoctorListItem[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.doctors.list, filters, () => mock.listDoctors(filters))
  },
  get(id: string): Promise<DoctorDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.doctors.get, { id }, () => mock.getDoctor(id))
  },
  save(input: DoctorInput, id?: string): Promise<Doctor> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.doctors.save, { id, ...input }, () => mock.saveDoctor(input, id))
  },
  setOnline(id: string, online: boolean): Promise<Doctor> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (doctor availability flow).
    return invoke(F.doctors.setOnline, { id, online }, () => mock.setDoctorOnline(id, online))
  },
  /** Slots for a date with booked/past slots marked unavailable (prevents overlaps). */
  slots(doctorId: string, date: string): Promise<SlotView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.doctors.slots, { doctorId, date }, () => mock.doctorSlotsFor(doctorId, date))
  },
}
