import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/inpatientHandlers'
import type { AdmissionView, DischargeInput } from '../types/clinicApi'

/** Discharge: Requested → Under review → Approved (doctor) → Completed (bill settled, bed released). */
export const dischargeService = {
  list(status?: string): Promise<AdmissionView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.discharge.list, { status }, () => mock.listDischarges(status))
  },
  request(admissionId: string, note?: string): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (discharge approval workflow start).
    return invoke(F.discharge.request, { admissionId, note }, () => mock.requestDischarge(admissionId, note))
  },
  saveSummary(admissionId: string, input: DischargeInput): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.discharge.saveSummary, { admissionId, ...input }, () => mock.saveDischargeSummary(admissionId, input))
  },
  approve(admissionId: string, input: DischargeInput): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (doctor approval).
    return invoke(F.discharge.approve, { admissionId, ...input }, () => mock.approveDischarge(admissionId, input))
  },
  complete(admissionId: string): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.discharge.complete, { admissionId }, () => mock.completeDischarge(admissionId))
  },
}
