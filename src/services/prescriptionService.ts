import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import * as mock from '../mock/clinic/recordsHandlers'
import type { DispenseRecord, PrescriptionDetail, PrescriptionFilters, PrescriptionInput, PrescriptionView } from '../types/clinicApi'

/** Electronic prescriptions. Only Doctor-role users linked to a doctor profile may create or finalise. */
export const prescriptionService = {
  list(filters: PrescriptionFilters = {}): Promise<PrescriptionView[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.prescriptions.list, filters, () => mock.listPrescriptions(filters))
  },
  /** Includes live pharmacy availability per prescribed item. */
  get(id: string): Promise<PrescriptionDetail> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.prescriptions.get, { id }, () => mock.getPrescription(id))
  },
  saveDraft(input: PrescriptionInput, id?: string): Promise<PrescriptionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (prescription creation flow).
    return invoke(F.prescriptions.saveDraft, { id, ...input }, () => mock.savePrescriptionDraft(input, id))
  },
  /** Doctor signs: server must verify the caller is the prescribing, registered practitioner. */
  finalise(id: string, confirmName: string): Promise<PrescriptionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration (prescription approval flow, digital signature).
    return invoke(F.prescriptions.finalise, { id, confirmName }, () => mock.finalisePrescription(id, confirmName))
  },
  deleteDraft(id: string): Promise<void> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.prescriptions.deleteDraft, { id }, () => mock.deletePrescriptionDraft(id))
  },
  /** Records pharmacy fulfilment after a POS sale (links sale ↔ prescription). */
  recordDispense(rec: DispenseRecord): Promise<PrescriptionView> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.prescriptions.dispense, rec, () => mock.recordDispense(rec))
  },
}
