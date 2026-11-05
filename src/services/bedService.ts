import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/inpatientHandlers'
import type { Bed } from '../types/clinic'
import type { AdmissionView } from '../types/clinicApi'

/** Bed allocation, transfer and maintenance. The server must lock beds to prevent double allocation. */
export const bedService = {
  allocate(admissionId: string, bedId: string): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (bed allocation flow).
    return invoke(F.beds.allocate, { admissionId, bedId }, () => mock.allocateBed(admissionId, bedId))
  },
  transfer(admissionId: string, bedId: string, reason: string): Promise<AdmissionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.beds.transfer, { admissionId, bedId, reason }, () => mock.transferBed(admissionId, bedId, reason))
  },
  setMaintenance(bedId: string, maintenance: boolean, note?: string): Promise<Bed> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.beds.maintenance, { bedId, maintenance, note }, () => mock.setBedMaintenance(bedId, maintenance, note))
  },
}
