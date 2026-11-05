import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/inpatientHandlers'
import type { AdmissionDetail, AdmissionFilters, AdmissionRequestInput, AdmissionView, InpatientDashboard } from '../types/clinicApi'

/** Admission workflow: Requested → Approved → (bed allocated) → Admitted → Under treatment → Discharge. */
export const admissionService = {
  list(filters: AdmissionFilters = {}): Promise<AdmissionView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.admissions.list, filters, () => mock.listAdmissions(filters))
  },
  get(id: string): Promise<AdmissionDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.admissions.get, { id }, () => mock.getAdmission(id))
  },
  request(input: AdmissionRequestInput): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (admission approval workflow start).
    return invoke(F.admissions.request, input, () => mock.requestAdmission(input))
  },
  approve(id: string): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (admission approval flow).
    return invoke(F.admissions.approve, { id }, () => mock.approveAdmission(id))
  },
  /** Bed must be allocated first; creates the inpatient record and opens the patient account. */
  confirm(id: string): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.admissions.confirm, { id }, () => mock.confirmAdmission(id))
  },
  cancel(id: string, reason: string): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.admissions.cancel, { id, reason }, () => mock.cancelAdmission(id, reason))
  },
  dashboard(filters: { department?: string; doctorId?: string; roomType?: string } = {}): Promise<InpatientDashboard> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.admissions.dashboard, filters, () => mock.inpatientDashboard(filters))
  },
}
